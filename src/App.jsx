import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Line } from "react-konva";

const TILE_SIZE = 32;
const MAP_COLS = 24;
const MAP_ROWS = 16;

export default function App() {
  const [tilesetImg, setTilesetImg] = useState(null);
  const [tilesetCols, setTilesetCols] = useState(0);
  const [tilesetRows, setTilesetRows] = useState(0);
  const [selectedTile, setSelectedTile] = useState(null);
  const [tool, setTool] = useState("draw");
  const [cellSize, setCellSize] = useState(32);
  const [paletteZoom, setPaletteZoom] = useState(2);
  const [mapData, setMapData] = useState(() => Array(MAP_COLS * MAP_ROWS).fill(null));

  const paintingRef = useRef(false);
  const paintToolRef = useRef("draw");

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
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const col = Math.floor(pos.x / (TILE_SIZE * paletteZoom));
    const row = Math.floor(pos.y / (TILE_SIZE * paletteZoom));
    if (col < 0 || row < 0 || col >= tilesetCols || row >= tilesetRows) return;
    setSelectedTile({ col, row });
    setTool("draw");
  };

  const paintCellAt = useCallback(
    (pos, currentTool) => {
      const col = Math.floor(pos.x / cellSize);
      const row = Math.floor(pos.y / cellSize);
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
    [cellSize, selectedTile]
  );

  const handleMapMouseDown = (e) => {
    const isRightClick = e.evt.button === 2;
    const currentTool = isRightClick ? "erase" : tool;
    paintToolRef.current = currentTool;
    paintingRef.current = true;
    const stage = e.target.getStage();
    paintCellAt(stage.getPointerPosition(), currentTool);
  };

  const handleMapMouseMove = (e) => {
    if (!paintingRef.current) return;
    const stage = e.target.getStage();
    paintCellAt(stage.getPointerPosition(), paintToolRef.current);
  };

  const stopPainting = () => {
    paintingRef.current = false;
  };

  useEffect(() => {
    window.addEventListener("mouseup", stopPainting);
    return () => window.removeEventListener("mouseup", stopPainting);
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

  const gridLines = (cols, rows, size) => {
    const lines = [];
    for (let i = 0; i <= cols; i++) {
      lines.push(
        <Line
          key={`v${i}`}
          points={[i * size, 0, i * size, rows * size]}
          stroke="#00000033"
          strokeWidth={1}
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
        />
      );
    }
    return lines;
  };

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
          <label style={{ fontSize: 12 }}>
            Palette zoom: {paletteZoom}x{" "}
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={paletteZoom}
              onChange={(e) => setPaletteZoom(Number(e.target.value))}
            />
          </label>
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
              width={tilesetCols * TILE_SIZE * paletteZoom}
              height={tilesetRows * TILE_SIZE * paletteZoom}
              onClick={handlePaletteClick}
            >
              <Layer>
                <KonvaImage
                  image={tilesetImg}
                  width={tilesetCols * TILE_SIZE * paletteZoom}
                  height={tilesetRows * TILE_SIZE * paletteZoom}
                />
                {gridLines(tilesetCols, tilesetRows, TILE_SIZE * paletteZoom)}
                {selectedTile && (
                  <Rect
                    x={selectedTile.col * TILE_SIZE * paletteZoom}
                    y={selectedTile.row * TILE_SIZE * paletteZoom}
                    width={TILE_SIZE * paletteZoom}
                    height={TILE_SIZE * paletteZoom}
                    stroke="#ffcc00"
                    strokeWidth={2}
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
          <label style={{ fontSize: 12 }}>
            Map zoom: {cellSize}px{" "}
            <input
              type="range"
              min="16"
              max="64"
              step="1"
              value={cellSize}
              onChange={(e) => setCellSize(Number(e.target.value))}
            />
          </label>
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
            style={{ display: "inline-block", border: "1px solid #444" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Stage
              width={MAP_COLS * cellSize}
              height={MAP_ROWS * cellSize}
              onMouseDown={handleMapMouseDown}
              onMouseMove={handleMapMouseMove}
              onMouseUp={stopPainting}
            >
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={MAP_COLS * cellSize}
                  height={MAP_ROWS * cellSize}
                  fill="#12121a"
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
                      x={col * cellSize}
                      y={row * cellSize}
                      width={cellSize}
                      height={cellSize}
                      listening={false}
                    />
                  );
                })}
                {gridLines(MAP_COLS, MAP_ROWS, cellSize)}
              </Layer>
            </Stage>
          </div>
        )}
      </div>
    </div>
  );
}
