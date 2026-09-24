import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Line } from "react-konva";

const MAP_VIEW_WIDTH = 1280;
const MAP_VIEW_HEIGHT = 720;
const PALLETE_VIEW_WIDTH = 276;
const PALLETE_VIEW_HEIGHT = 380;

const TILE_SIZE = 32;
const MAP_COLS = 24;
const MAP_ROWS = 16;

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export default function App() {
  const [tilesetImg, setTilesetImg] = useState(null);
  const [tilesetCols, setTilesetCols] = useState(0);
  const [tilesetRows, setTilesetRows] = useState(0);

  const [selectedTile, setSelectedTile] = useState(null);
  const [tool, setTool] = useState("draw");

  // const [cellSize, setCellSize] = useState(32);
  // const [paletteZoom, setPaletteZoom] = useState(2);
  
  const [mapData, setMapData] = useState(() => Array(MAP_COLS * MAP_ROWS).fill(null));

  const [mapStagePos, setMapStagePos] = useState({ x: 0, y: 0 });
  const [mapStageScale, setMapStageScale] = useState(1);
  const [paletteStagePos, setPaletteStagePos] = useState({ x: 0, y: 0 });
  const [paletteStageScale, setPaletteStageScale] = useState(1);

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
    }, []);
  

    const paintingRef = useRef(false);
    const paintToolRef = useRef("draw");
  
    const isPanningMapRef = useRef(false);
    const lastPointerMapRef = useRef(null);
  
    const isPanningPaletteRef = useRef(false);
    const lastPointerPaletteRef = useRef(null);
    const paletteDraggedRef = useRef(false);

  function getRelativePointerPosition(stage) {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  }

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
    setTool("draw");
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

    if(isMiddleClick || isSpacePan) {
      isPanningMapRef.current = true;
      lastPointerMapRef.current = stage.getPointerPosition();
      return;
    }

    const isRightClick = e.evt.button === 2;
    const currentTool = isRightClick ? "erase" : tool;
    paintToolRef.current = currentTool;
    paintingRef.current = true;
    paintCellAt(getRelativePointerPosition(stage), currentTool);
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

    if (!paintingRef.current) return;
    paintCellAt(getRelativePointerPosition(stage), paintToolRef.current);
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

  // const stopPainting = () => {
  //   paintingRef.current = false;
  // };

  const stopInteraction = () => {
    paintingRef.current = false;
    isPanningMapRef.current = false;
    isPanningPaletteRef.current = false;
  }

  useEffect(() => {
    window.addEventListener("mouseup", stopInteraction);
    return () => window.removeEventListener("mouseup", stopInteraction);
  }, []);

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

  // const handleWheelMapGrid = (e) =>{
  //   console.log(e);
  //   if(e.evt.shiftKey){
  //     if(e.evt.deltaY>0){
  //       setCellSize(cellSize-1);
  //     }
  //     else if(e.evt.deltaY<0){
  //       setCellSize(cellSize+1);
  //     }
  //   }
  // }

  // const handleWheelTilemapGrid = (e) =>{
  //   console.log(e);
  //   if(e.evt.shiftKey){
  //     if(e.evt.deltaY>0  && paletteZoom > 1){
  //       setPaletteZoom(paletteZoom-1);
  //     }
  //     else if(e.evt.deltaY<0){
  //       setPaletteZoom(paletteZoom+1);
  //     }
  //   }
  // }

  // const handleScrollWheelClick = (e) => {
  //   console.log(e);
  //   if(e.evt.button === 1){
  //     e.target.getStage()
  //     console.log(e.evt.clientX)
  //     console.log(e.evt.clientY)
  //   }
  // }

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

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "sans-serif",
        background: "#1e1e2a",
        color: "#eee",
      }}
    >
      <div
        style={{
          width: 300,
          padding: 12,
          borderRight: "1px solid #333",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Tileset</h3>
        <input type="file" accept="image/*" onChange={handleUpload} />

        {tilesetImg && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {tilesetCols} x {tilesetRows} tiles ({tilesetImg.width}x
            {tilesetImg.height}px)
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          {/* <label style={{ fontSize: 12 }}>
            Palette zoom: {paletteZoom}x{" "}
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={paletteZoom}
              onChange={(e) => setPaletteZoom(Number(e.target.value))}
            />
          </label> */}
          <span style={{ fontSize: 11, opacity: 0.7 }}>
              {Math.round(paletteStageScale * 100)}%
          </span>
          <button onClick={resetPaletteView} >
              Reset view Pallete
          </button>
        </div>

        {tilesetImg && (
          <div
            style={{
              marginTop: 10,
              border: "1px solid #444",
              overflow: "auto",
              maxHeight: "45vh",
            }}
          >
            <Stage
              width={PALLETE_VIEW_WIDTH}
              height={PALLETE_VIEW_HEIGHT}
              x={paletteStagePos.x}
              y={paletteStagePos.y}
              scaleX={paletteStageScale}
              scaleY={paletteStageScale}
              onClick={handlePaletteClick}
              // onWheel={handleWheelTilemapGrid}
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
                    stroke="#ffcc00"
                    strokeWidth={2}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        )}

        <h3>Tools</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setTool("draw")}
            style={{
              padding: "6px 10px",
              background: tool === "draw" ? "#ffcc00" : "#333",
              color: tool === "draw" ? "#111" : "#eee",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Draw
          </button>
          <button
            onClick={() => setTool("erase")}
            style={{
              padding: "6px 10px",
              background: tool === "erase" ? "#ffcc00" : "#333",
              color: tool === "erase" ? "#111" : "#eee",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Erase
          </button>
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          right-click on the grid to erase without switching tools.
        </div>

        <div style={{ marginTop: 14 }}>
          {/* <label style={{ fontSize: 12 }}>
            Map zoom: {cellSize}px{" "}
            <input
              type="range"
              min="16"
              max="64"
              step="1"
              value={cellSize}
              onChange={(e) => setCellSize(Number(e.target.value))}
            />
          </label> */}
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
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Map</h3>
        {!tilesetImg ? (
          <div style={{ opacity: 0.6 }}>Upload a tileset to start drawing.</div>
        ) : (
          <div
            style={{ display: "inline-block", border: "1px solid #444",width: MAP_VIEW_WIDTH,height: MAP_VIEW_HEIGHT,overflow: "hidden",cursor: spaceDown ? "grab" : tool === "erase" ? "cell" : "crosshair", }}
            onContextMenu={(e) => e.preventDefault()}
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
              // onMouseUp={stopPainting}
              // onWheel={handleWheelMapGrid}
              // onClick={handleScrollWheelClick}
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
                {gridLines(MAP_COLS, MAP_ROWS, TILE_SIZE)}
              </Layer>
            </Stage>
          </div>
        )}
      </div>
    </div>
  );
}
