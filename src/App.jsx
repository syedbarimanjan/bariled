import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Line } from "react-konva";
import { Grid3x3, Paintbrush, PenLine, Eraser, Undo2, Plus, Square } from "lucide-react";
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
        "h-8 w-8 rounded-full cursor-pointer",
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
  const [selectedTiles, setSelectedTiles] = useState(null);
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
  const paletteSelectStartRef = useRef(null);
  const paletteHoverRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setTilesetImg(img);
      setTilesetCols(Math.floor(img.width / TILE_SIZE));
      setTilesetRows(Math.floor(img.height / TILE_SIZE));
      setSelectedTiles(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const paintCellAt = useCallback(
    (pos, currentTool) => {
      if(!pos) return;
      const startingCol = Math.floor(pos.x / TILE_SIZE);
      const startingRow = Math.floor(pos.y / TILE_SIZE);
      
      setMapData((prev) => {
        if (currentTool === "erase") {
          if (startingCol < 0 || startingRow < 0 || startingCol >= MAP_COLS || startingRow >= MAP_ROWS) return prev;
          const index = startingRow * MAP_COLS + startingCol;

          if (prev[index] === null) return prev;
          const next = prev.slice();
          next[index] = null;
          return next;
        }
        if (!selectedTiles) return prev;
        const next = prev.slice();
        let changed = false;
        selectedTiles.forEach((tile) => {
          const col = startingCol + tile.dx;
          const row = startingRow + tile.dy;
          if(col<0||row<0||col>=MAP_COLS||row>=MAP_ROWS) return;
            const index = row * MAP_COLS + col;
            next[index] = {col: tile.col,row: tile.row};
            changed = true;
        })
        return changed ? next : prev;
      });
    },
    [selectedTiles]
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

    if(isMiddleClick || isSpacePan) {
      isPanningPaletteRef.current = true;
      lastPointerPaletteRef.current = stage.getPointerPosition();
    }

    const pos = getRelativePointerPosition(stage);
    if(!pos)return;
    const col = Math.floor(pos.x/TILE_SIZE);
    const row = Math.floor(pos.y/TILE_SIZE);
    paletteSelectStartRef.current = {col,row};
    paletteHoverRef.current = {col,row};
  }

  const handlePaletteMouseMove = (e) => {
    const stage = e.target.getStage();
    if(isPanningPaletteRef.current) {
      const pointer = stage.getPointerPosition();
      const last = lastPointerPaletteRef.current;
      if(pointer && last) {
        const dx = pointer.x -last.x;
        const dy = pointer.y -last.y;
        setPaletteStagePos((prev) => ({x:prev.x + dx, y:prev.y+dy}));
      }
      lastPointerPaletteRef.current = pointer;
      return;
    }

    if(paletteSelectStartRef.current){
      const pos = getRelativePointerPosition(stage);
      if(pos) {
        paletteHoverRef.current = {
          col: Math.floor(pos.x/TILE_SIZE),
          row: Math.floor(pos.y/TILE_SIZE)
        }
      }
    }
  }

  const stopInteraction = () => {
    
    if(lineStartRef.current && cellHover && selectedTiles && tool === "line") {
      const lineCells = getLineCellsUsingBresenhamsAlgorithm(lineStartRef.current.col,lineStartRef.current.row,cellHover.col,cellHover.row);
      setMapData((prev) =>{
        const next = prev.slice();
        let changed = false;
        lineCells.forEach(({col,row},i) => {
          selectedTiles.forEach((tile) => {
            const newCol = col +tile.dx;
            const newRow = row+tile.dy;
            if(newCol>=0&&newRow>=0&&newCol<MAP_COLS&&newRow<MAP_ROWS) {
              const index = newRow * MAP_COLS + newCol;
              next[index] = {col:tile.col,row:tile.row};
              changed=true;
            }
          })
        })
        return changed ? next : prev;
      })
    }
    if(rectangleStartRef.current && cellHover && selectedTiles && tool === "rectangle"){
      const recCells = getRectangleCells(rectangleStartRef.current.col,rectangleStartRef.current.row,cellHover.col,cellHover.row);
      setMapData((prev) =>{
        const next = prev.slice();
        let changed = false;
        recCells.forEach(({col,row},i) => {
          selectedTiles.forEach((tile) => {
            const newCol = col +tile.dx;
            const newRow = row+tile.dy;
            if(newCol>=0&&newRow>=0&&newCol<MAP_COLS&&newRow<MAP_ROWS) {
              const index = newRow * MAP_COLS + newCol;
              next[index] = {col:tile.col,row:tile.row};
              changed=true;
            }
          })
        })
        return changed ? next : prev;
      })
    }

    if(paletteSelectStartRef.current && paletteHoverRef.current) {
      const start = paletteSelectStartRef.current;
      const end = paletteHoverRef.current;
      const startCol = Math.max(0,Math.min(start.col,end.col));
      const endCol = Math.min(tilesetCols-1,Math.max(start.col,end.col));
      const startRow = Math.max(0,Math.min(start.row,end.row));
      const endRow = Math.min(tilesetRows-1,Math.max(start.row,end.row));
      const tiles = [];
      for (let r = startRow; r <= endRow;r++) {
        for (let c = startCol; c<= endCol;c++){
          tiles.push({col:c,row:r,dx:c-startCol,dy:r-startRow});
        }
      }
      if(tiles.length) setSelectedTiles(tiles);
      paletteSelectStartRef.current = null;
      paletteHoverRef.current = null;
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
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between px-6 pt-4">
          <div className="flex items-center gap-2">
            <Grid3x3 size={20} className="text-sky-400" />
            <span className="text-[15px] font-semibold text-slate-100">
              Bariled
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 px-2 py-1.5">
            <ToolButton icon={Paintbrush} active={tool === "draw"} onClick={() => setTool("draw")} title="Draw" />
            <ToolButton icon={Square} active={tool === "rectangle"} onClick={() => setTool("rectangle")} title="Rectangle" />
            <ToolButton icon={PenLine} active={tool === "line"} onClick={() => setTool("line")} title="Line" />
            <ToolButton icon={Eraser} active={tool === "erase"} onClick={() => setTool("erase")} title="Erase" />
            <ToolButton icon={Undo2} onClick={handleUndo} title="Undo (Ctrl+Z)" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex flex-1 items-center justify-center overflow-auto p-6">
            <div className="flex flex-col items-center">
              <Card className="border-slate-800 bg-black p-4">
                {!tilesetImg ? (
                  <div className="text-sm text-slate-500">Upload a tileset to start drawing.</div>
                ) : (
                  <div
                    style={{ display: "inline-block", border: "1px solid #444",width: "70vw",height: MAP_VIEW_HEIGHT,overflow: "hidden",cursor: spaceDown ? "grab" : tool === "erase" ? "cell" : "crosshair", }}
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
                          tilesetImg && selectedTiles && cellHover && tool !== "erase" && (
                            selectedTiles.map((tile,i)=>{
                              return ( <KonvaImage
                                key={i}
                                image={tilesetImg}
                                crop={{
                                  x: tile.col * TILE_SIZE,
                                  y: tile.row * TILE_SIZE,
                                  width: TILE_SIZE,
                                  height: TILE_SIZE,
                                }}
                                x={(cellHover.col + tile.dx) * TILE_SIZE}
                                y={(cellHover.row + tile.dy) * TILE_SIZE}
                                width={TILE_SIZE}
                                height={TILE_SIZE}
                                opacity={0.5}
                                listening={false}
                              />)
                            })
                          )
                        }
                        {
                          tilesetImg && selectedTiles && lineStartRef.current && cellHover && tool === "line" && (
                            getLineCellsUsingBresenhamsAlgorithm(lineStartRef.current.col,lineStartRef.current.row,cellHover.col,cellHover.row).map((cell,index) => (
                            selectedTiles.map((tile,i)=>{
                              return (<KonvaImage
                                key={i}
                                image={tilesetImg}
                                crop={{
                                  x: tile.col * TILE_SIZE,
                                  y: tile.row * TILE_SIZE,
                                  width: TILE_SIZE,
                                  height: TILE_SIZE,
                                }}
                                x={(cell.col + tile.dx) * TILE_SIZE}
                                y={(cell.row + tile.dy) * TILE_SIZE}
                                width={TILE_SIZE}
                                height={TILE_SIZE}
                                opacity={0.5}
                                listening={false}
                              />)
                            })
                            ))
                          )
                        }
                        {
                          tilesetImg && selectedTiles && rectangleStartRef.current && cellHover && tool === "rectangle" && (
                            getRectangleCells(rectangleStartRef.current.col,rectangleStartRef.current.row,cellHover.col,cellHover.row).map((cell,index) => (
                            selectedTiles.map((tile,i)=>{
                              return (<KonvaImage
                                key={i}
                                image={tilesetImg}
                                crop={{
                                  x: tile.col * TILE_SIZE,
                                  y: tile.row * TILE_SIZE,
                                  width: TILE_SIZE,
                                  height: TILE_SIZE,
                                }}
                                x={(cell.col + tile.dx) * TILE_SIZE}
                                y={(cell.row + tile.dy) * TILE_SIZE}
                                width={TILE_SIZE}
                                height={TILE_SIZE}
                                opacity={0.5}
                                listening={false}
                              />)
                            })
                            ))
                          )
                        }
                        {/* {
                          selectedTiles && selectedTiles
                        } */}
                        {gridLines(MAP_COLS, MAP_ROWS, TILE_SIZE)}
                      </Layer>
                    </Stage>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end px-6 py-4">
          <div className="flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/70 px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={clearMap}
              className="h-8 rounded-full px-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
            >
              Clear Map
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={exportMap}
              className="h-8 rounded-full px-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
            >
              Export JSON
            </Button>
            <div className="rounded-full flex items-center px-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 cursor-pointer">
              <span className="text-[11px] text-slate-400">
                {Math.round(mapStageScale * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost" 
                onClick={resetMapView}
                className="h-8 px-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 cursor-pointer">
                Reset view Map
              </Button>
            </div>
          </div>
        </div>
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
            className="ml-auto h-8 w-8 flex shrink-0 rounded-full border-slate-700 bg-black text-slate-200 hover:bg-slate-800 cursor-pointer"
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

        {tilesetImg ? (
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-black">
            <Stage
              width={PALLETE_VIEW_WIDTH}
              height={PALLETE_VIEW_HEIGHT}
              x={paletteStagePos.x}
              y={paletteStagePos.y}
              scaleX={paletteStageScale}
              scaleY={paletteStageScale}
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

                {selectedTiles && (
                  selectedTiles.map((tile,i)=>{
                    return (<Rect
                      x={tile.col * TILE_SIZE}
                      y={tile.row * TILE_SIZE}
                      width={TILE_SIZE}
                      height={TILE_SIZE}
                      stroke="#ffcc00"
                      strokeWidth={2}
                      listening={false}
                    />)
                  })
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
          <button onClick={resetPaletteView} className="text-sky-400 hover:underline cursor-pointer">
            Reset view Pallete
          </button>
        </div>

        <Button>Add layer</Button>
        <div className="mt-2 flex items-center justify-between rounded-md border border-white bg-black px-3 py-2">
          <div>
            <div className="text-xs font-medium text-slate-100">New Layer 1</div>
            <div className="text-[11px] text-slate-500">Terrain Tileset</div>
          </div>
        </div>
      </div>
    </div>
  );
}
