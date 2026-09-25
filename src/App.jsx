import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Line } from "react-konva";
import { Grid3x3, Paintbrush, PenLine, Eraser, Undo2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function ToolButton({ icon: Icon, active, onClick, title}) {
  return (
    <Button
      type="button"
      title={title}
      onClick={onClick}
      variant={active ? "default" : "ghost"}
      size="icon"
      className={[
        "h-8 w-8 rounded-full",
        active
          ? "bg-sky-400 text-slate-950 hover:bg-sky-400"
          : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
      ].join(" ")}
    >
      <Icon size={16} strokeWidth={2} />
    </Button>
  )
}
const MAP_VIEW_WIDTH = 1280;
const MAP_VIEW_HEIGHT = 720;
const PALLETE_VIEW_WIDTH = 276;
const PALLETE_VIEW_HEIGHT = 380;

const TILE_SIZE = 32;
const MAP_COLS = 24;
const MAP_ROWS = 16;

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

function getLineCellsUsingBresenhamsAlgorithm(x0,y0,x1,y1) {
  const cells = [];
  const dx = Math.abs(x1-x0);
  const dy = Math.abs(y1-y0);
  const sx = (x0<x1) ? 1: -1;
  const sy = (y0<y1) ? 1: -1;
  let err = dx-dy;

  let cx=x0;
  let cy = y0;

  while(true){
    cells.push({col:cx,row:cy});
    if(cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if(e2> -dy) {
      err -= dy;
      cx += sx;
    }
    if(e2<dx){
      err+=dx;
      cy+=sy;
    }
  }
  return cells;
}

function getRectangleCells(x0, y0, x1, y1) {
    const cells = [];
    
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    
    let cy = y0;
    while (true) {
      
      let cx = x0;
      while (true) {
        cells.push({ col: cx, row: cy });
        
        if (cx === x1) break;
        cx += sx;
      }

      if (cy === y1) break;
      cy += sy;
    }

    return cells;
}

function getRelativePointerPosition(stage) {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  return transform.point(pointer);
}

export default function App() {
  const [tilesetImg, setTilesetImg] = useState(null);
  const [tilesetCols, setTilesetCols] = useState(0);
  const [tilesetRows, setTilesetRows] = useState(0);

  const [cellHover,setCellHover] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [tool, setTool] = useState("draw"); // "draw/erase/line/rectangle"
  const lineStartRef = useRef(null);
  const rectangleStartRef = useRef(null);
  const rectangleEndRef = useRef(null);
  
  const [mapData, setMapData] = useState(() => Array(MAP_COLS * MAP_ROWS).fill(null));
  const [mapStagePos, setMapStagePos] = useState({ x: 0, y: 0 });
  const [mapStageScale, setMapStageScale] = useState(1);
  const [paletteStagePos, setPaletteStagePos] = useState({ x: 0, y: 0 });
  const [paletteStageScale, setPaletteStageScale] = useState(1);

  const [undo,setUndo] = useState([mapData]);

  const [spaceDown, setSpaceDown] = useState(false);
  const spaceDownRef = useRef(false);
  useEffect(() => {
    spaceDownRef.current = spaceDown;
  }, [spaceDown]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      }
      if(e.ctrlKey && e.code === "KeyZ"){
        e.preventDefault();
        if(undo.length > 0){
          if (undo.length === 0) return;
          const undoCopy = [...undo];
          const prevMap = undoCopy.pop();
          setMapData(prevMap);
          setUndo(undoCopy);
        }
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo,setUndo,setMapData]);

  const paintingRef = useRef(false);
  const paintToolRef = useRef("draw");

  const isPanningMapRef = useRef(false);
  const lastPointerMapRef = useRef(null);

  const isPanningPaletteRef = useRef(false);
  const lastPointerPaletteRef = useRef(null);
  const paletteDraggedRef = useRef(false);

  const handleUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setTilesetImg(img);
      setTilesetCols(Math.floor(img.width / TILE_SIZE));
      setTilesetRows(Math.floor(img.height / TILE_SIZE));
      setSelectedTile(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handlePaletteClick = (e) => {
    if(paletteDraggedRef.current){
      paletteDraggedRef.current = false;
      return;
    }
    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);
    const col = Math.floor(pos.x / TILE_SIZE);
    const row = Math.floor(pos.y / TILE_SIZE);
    if (col < 0 || row < 0 || col >= tilesetCols || row >= tilesetRows) return;
    setSelectedTile({ col, row });
  };

  const paintCellAt = useCallback(
    (pos, currentTool) => {
      if(!pos) return;
      const col = Math.floor(pos.x / TILE_SIZE);
      const row = Math.floor(pos.y / TILE_SIZE);
      if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return;
      const index = row * MAP_COLS + col;

      setMapData((prev) => {
        if (currentTool === "erase") {
          if (prev[index] === null) return prev;
          const next = prev.slice();
          next[index] = null;
          return next;
        }
        if (!selectedTile) return prev;
        const existing = prev[index];
        if (
          existing &&
          existing.col === selectedTile.col &&
          existing.row === selectedTile.row
        ) {
          return prev;
        }
        const next = prev.slice();
        next[index] = { col: selectedTile.col, row: selectedTile.row };

        return next;
      });
    },
    [selectedTile]
  );

  const handleMapMouseDown = (e) => {
    const stage = e.target.getStage();
    const isMiddleClick = e.evt.button === 1;
    const isSpacePan = e.evt.button === 0 && spaceDownRef.current;
    const isRightClick = e.evt.button === 2;
    const currentTool = isRightClick ? "erase" : tool;
    const pos = getRelativePointerPosition(stage);
    
    if(isMiddleClick || isSpacePan) {
      isPanningMapRef.current = true;
      lastPointerMapRef.current = stage.getPointerPosition();
      return;
    }
    
    if(currentTool === "line") {
      const col = Math.floor(pos.x/TILE_SIZE);
      const row = Math.floor(pos.y/TILE_SIZE);
      lineStartRef.current = {col,row};
      paintingRef.current = true;
      return;
    }

    if(currentTool === "rectangle"){
      const col = Math.floor(pos.x/TILE_SIZE);
      const row = Math.floor(pos.y/TILE_SIZE);
      rectangleStartRef.current = {col,row};
      paintingRef.current = true;
      return;
    }

    paintToolRef.current = currentTool;
    paintingRef.current = true;
    paintCellAt(pos, currentTool);
    setUndo([...undo,mapData]);
  };

  const handleMapMouseMove = (e) => {
    const stage = e.target.getStage();

    if(isPanningMapRef.current) {
      const pointer = stage.getPointerPosition();
      const last = lastPointerMapRef.current;
      if(pointer&&last){
        const dx = pointer.x - last.x;
        const dy = pointer.y - last.y;
        setMapStagePos((prev) => ({x:prev.x + dx,y:prev.y +dy}));
      }
      lastPointerMapRef.current = pointer;
      return;
    }

    const pos = getRelativePointerPosition(stage);
    if(pos){
      const col = Math.floor(pos.x/TILE_SIZE);
      const row = Math.floor(pos.y/TILE_SIZE);
      setCellHover({col,row});
    }

    if (!paintingRef.current) return;

    if(tool === "draw" || paintToolRef.current === "erase") {
      paintCellAt(pos, paintToolRef.current);
    }
  };

  const handlePaletteMouseDown = (e) => {
    const stage = e.target.getStage();
    const isMiddleClick = e.evt.button === 1;
    const isSpacePan = e.evt.button === 0 && spaceDownRef.current;

    paletteDraggedRef.current = false;

    if(isMiddleClick || isSpacePan) {
      isPanningPaletteRef.current = true;
      lastPointerPaletteRef.current = stage.getPointerPosition();
    }
  }

  const handlePaletteMouseMove = (e) => {
    if(!isPanningPaletteRef.current) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const last = lastPointerPaletteRef.current;
    if(pointer && last) {
      const dx = pointer.x -last.x;
      const dy = pointer.y -last.y;
      if(dx!==0||dy!==0) paletteDraggedRef.current = true;
      setPaletteStagePos((prev) => ({x:prev.x + dx, y:prev.y+dy}));
    }
    lastPointerPaletteRef.current = pointer;
  }

  const stopInteraction = () => {
    
    if(lineStartRef.current && cellHover && selectedTile && tool === "line") {
      const lineCells = getLineCellsUsingBresenhamsAlgorithm(lineStartRef.current.col,lineStartRef.current.row,cellHover.col,cellHover.row);
      setMapData((prev) =>{
        const next = prev.slice();
        let changed = false;
        lineCells.forEach(({col,row}) => {
          if(col>=0&&row>=0&&col<MAP_COLS&&row<MAP_ROWS) {
            const index = row * MAP_COLS + col;
            next[index] = {col: selectedTile.col,row: selectedTile.row};
            changed = true;
          }
        })
        return changed ? next : prev;
      })
    }
    if(rectangleStartRef.current && cellHover && selectedTile && tool === "rectangle"){
      const recCells = getRectangleCells(rectangleStartRef.current.col,rectangleStartRef.current.row,cellHover.col,cellHover.row);
      setMapData((prev) =>{
        const next = prev.slice();
        let changed = false;
        recCells.forEach(({col,row}) => {
          if(col>=0&&row>=0&&col<MAP_COLS&&row<MAP_ROWS) {
            const index = row * MAP_COLS + col;
            next[index] = {col: selectedTile.col,row: selectedTile.row};
            changed = true;
          }
        })
        return changed ? next : prev;
      })
    }
    lineStartRef.current = null;
    rectangleStartRef.current = null;
    rectangleEndRef.current = null;
    paintingRef.current = false;
    isPanningMapRef.current = false;
    isPanningPaletteRef.current = false;
  }

  useEffect(() => {
    window.addEventListener("mouseup", stopInteraction);
    return () => window.removeEventListener("mouseup", stopInteraction);
  }, [stopInteraction]);

  const clearMap = () => setMapData(Array(MAP_COLS * MAP_ROWS).fill(null));

  const exportMap = () => {
    const blob = new Blob([JSON.stringify(mapData)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetMapView = () => {
    setMapStagePos({ x: 0, y: 0 });
    setMapStageScale(1);
  };

  const resetPaletteView = () => {
    setPaletteStagePos({ x: 0, y: 0 });
    setPaletteStageScale(1);
  };

  const handleMapMouseLeave = () => {
    setCellHover(null);
  }

  const gridLines = (cols, rows, size) => {
    const lines = [];
    for (let i = 0; i <= cols; i++) {
      lines.push(
        <Line
          key={`v${i}`}
          points={[i * size, 0, i * size, rows * size]}
          stroke="#00000033"
          strokeWidth={1}
          listening={false}
        />
      );
    }
    for (let j = 0; j <= rows; j++) {
      lines.push(
        <Line
          key={`h${j}`}
          points={[0, j * size, cols * size, j * size]}
          stroke="#00000033"
          strokeWidth={1}
          listening={false}
        />
      );
    }
    return lines;
  };

  const handleWheelZoom = (e,scale,setScale,pos,setPos) => {
    const isZoomModifier = e.evt.ctrlKey || e.evt.metaKey;
    if(!isZoomModifier) return;
    e.evt.preventDefault();

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if(!pointer) return;


    const worldPoint = {x:(pointer.x - pos.x) / scale,y:(pointer.y - pos.y) /scale};
    const direction = e.evt.deltaY > 0 ? -1:1;
    const scaleBy = 1.08;
    let newScale = direction > 0 ? scale * scaleBy : scale / scaleBy;
    newScale = Math.min(MAX_SCALE,Math.max(MIN_SCALE,newScale));

    setScale(newScale);
    setPos({x:pointer.x - worldPoint.x * newScale,y:pointer.y - worldPoint.y * newScale});
  }

  const fileInputRef = useRef(null);

  const handleUndo = (e) => {
    if (undo.length === 0) return;
    const undoCopy = [...undo];
    const prevMap = undoCopy.pop();
    setMapData(prevMap);
    setUndo(undoCopy);
  }

  return (
    <div className="flex h-screen bg-[#0a0a0e] text-slate-200">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Grid3x3 size={20} className="text-sky-400" />
          <span className="text-[15px] font-semibold text-slate-100">
            Bariled
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 px-2 py-1.5">
          <ToolButton icon={Paintbrush} active={tool === "draw"} onClick={() => setTool("draw")} title="Draw" />
          <ToolButton icon={PenLine} active={tool === "line"} onClick={() => setTool("line")} title="Line" />
          <ToolButton icon={Eraser} active={tool === "erase"} onClick={() => setTool("erase")} title="Erase" />
          <ToolButton icon={Undo2} onClick={handleUndo} title="Undo (Ctrl+Z)" />
        </div>
        <div className="w-8" />
      </div>
      <div className="flex min-h-0 flex-1">
      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        <Card className="border-slate-800 bg-black p-4">
        {!tilesetImg ? (
          <div className="text-sm text-slate-500">Upload a tileset to start drawing.</div>
        ) : (
          <div
            style={{ display: "inline-block", border: "1px solid #444",width: MAP_VIEW_WIDTH,height: MAP_VIEW_HEIGHT,overflow: "hidden",cursor: spaceDown ? "grab" : tool === "erase" ? "cell" : "crosshair", }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={handleMapMouseLeave}
          >
            <Stage
              width={MAP_VIEW_WIDTH}
              height={MAP_VIEW_HEIGHT}
              x={mapStagePos.x}
              y={mapStagePos.y}
              scaleX={mapStageScale}
              scaleY={mapStageScale}
              onMouseDown={handleMapMouseDown}
              onMouseMove={handleMapMouseMove}
              onWheel={(e) => handleWheelZoom(e,mapStageScale,setMapStageScale,mapStagePos,setMapStagePos)}
            >
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={MAP_COLS * TILE_SIZE}
                  height={MAP_ROWS * TILE_SIZE}
                  fill="#12121a"
                  listening={false}
                />
                {mapData.map((tile, i) => {
                  if (!tile) return null;
                  const col = i % MAP_COLS;
                  const row = Math.floor(i / MAP_COLS);
                  return (
                    <KonvaImage
                      key={i}
                      image={tilesetImg}
                      crop={{
                        x: tile.col * TILE_SIZE,
                        y: tile.row * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                      }}
                      x={col * TILE_SIZE}
                      y={row * TILE_SIZE}
                      width={TILE_SIZE}
                      height={TILE_SIZE}
                      listening={false}
                    />
                  );
                })}
                {
                  tilesetImg && selectedTile && cellHover && tool !== "erase" && (
                      <KonvaImage
                        // key={"i"}
                        image={tilesetImg}
                        crop={{
                          x: selectedTile.col * TILE_SIZE,
                          y: selectedTile.row * TILE_SIZE,
                          width: TILE_SIZE,
                          height: TILE_SIZE,
                        }}
                        x={cellHover.col * TILE_SIZE}
                        y={cellHover.row * TILE_SIZE}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        opacity={0.5}
                        listening={false}
                      />
                  )
                }
                {
                  tilesetImg && selectedTile && lineStartRef.current && cellHover && tool === "line" && (
                    getLineCellsUsingBresenhamsAlgorithm(lineStartRef.current.col,lineStartRef.current.row,cellHover.col,cellHover.row).map((cell,index) => (
                      <KonvaImage
                        key={index}
                        image={tilesetImg}
                        crop={{
                          x: selectedTile.col * TILE_SIZE,
                          y: selectedTile.row * TILE_SIZE,
                          width: TILE_SIZE,
                          height: TILE_SIZE,
                        }}
                        x={cell.col * TILE_SIZE}
                        y={cell.row * TILE_SIZE}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        opacity={0.5}
                        listening={false}
                      />
                    ))
                  )
                }
                {
                  tilesetImg && selectedTile && rectangleStartRef.current && cellHover && tool === "rectangle" && (
                    getRectangleCells(rectangleStartRef.current.col,rectangleStartRef.current.row,cellHover.col,cellHover.row).map((cell,index) => (
                      <KonvaImage
                        key={index}
                        image={tilesetImg}
                        crop={{
                          x: selectedTile.col * TILE_SIZE,
                          y: selectedTile.row * TILE_SIZE,
                          width: TILE_SIZE,
                          height: TILE_SIZE,
                        }}
                        x={cell.col * TILE_SIZE}
                        y={cell.row * TILE_SIZE}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        opacity={0.5}
                        listening={false}
                      />
                    ))
                  )
                }
                {gridLines(MAP_COLS, MAP_ROWS, TILE_SIZE)}
              </Layer>
            </Stage>
          </div>
        )}
      </Card>
      </div>

      <div className="w-[300px] flex shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 bg-[#0a0a0e] p-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full border-slate-700 bg-black  px-3 py-1.5 text-xs leading-tight text-slate-100">
            Terrain 
            <br />
            <span className="text-slate-400">{TILE_SIZE}x{TILE_SIZE}</span>
          </div>

          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload tileset"
            className="ml-auto h-8 w-8 flex-shrink-0 rounded-full border-slate-700 bg-black text-slate-200 hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>

        {tilesetImg && (
          <div className="text-xs text-slate-500">
            {tilesetCols} x {tilesetRows} tiles ({tilesetImg.width}x
            {tilesetImg.height}px)
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
              {Math.round(paletteStageScale * 100)}%
          </span>
          <button onClick={resetPaletteView} >
              Reset view Pallete
          </button>
        </div>

        {tilesetImg ? (
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-black">
            <Stage
              width={PALLETE_VIEW_WIDTH}
              height={PALLETE_VIEW_HEIGHT}
              x={paletteStagePos.x}
              y={paletteStagePos.y}
              scaleX={paletteStageScale}
              scaleY={paletteStageScale}
              onClick={handlePaletteClick}
              onWheel={(e) => handleWheelZoom(e,paletteStageScale,setPaletteStageScale,paletteStagePos,setPaletteStagePos)}
              onMouseDown={handlePaletteMouseDown}
              onMouseMove={handlePaletteMouseMove}
            >
              <Layer>
                <KonvaImage
                  image={tilesetImg}
                  width={tilesetCols * TILE_SIZE}
                  height={tilesetRows * TILE_SIZE}
                />
                {gridLines(tilesetCols, tilesetRows, TILE_SIZE)}
                {selectedTile && (
                  <Rect
                    x={selectedTile.col * TILE_SIZE}
                    y={selectedTile.row * TILE_SIZE}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    stroke="#ffffff"
                    strokeWidth={2}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-700 bg-black px-3 py-10 text-center text-xs text-slate-500">
            Click the + above to upload a tileset.
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{Math.round(paletteStageScale * 100)}%</span>
          <button onClick={resetPaletteView} className="text-sky-400 hover:underline">
            Reset view Pallete
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-md border border-white bg-black px-3 py-2">
          <div>
            <div className="text-xs font-medium text-slate-100">New Layer 1</div>
            <div className="text-[11px] text-slate-500">Terrain Tileset</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {Math.round(mapStageScale * 100)}%
          </span>
          <button onClick={resetMapView}>
            Reset view Map
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={clearMap}
            style={{
              padding: "6px 10px",
              background: "#552222",
              color: "#eee",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Clear Map
          </button>
          <button
            onClick={exportMap}
            style={{
              padding: "6px 10px",
              background: "#225522",
              color: "#eee",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
