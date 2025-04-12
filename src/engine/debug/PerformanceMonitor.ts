import { WebGLRenderer } from 'three';

interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    points: number;
    lines: number;
    memoryUsage: {
        geometries: number;
        textures: number;
    };
    jsHeapSize: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor | null = null;
    private renderer: WebGLRenderer;
    private container: HTMLDivElement;
    private metrics: PerformanceMetrics;
    private lastTime: number;
    private frameCount: number;
    private updateInterval: number;
    private visible: boolean;
    private graphCanvas: HTMLCanvasElement;
    private graphContext: CanvasRenderingContext2D;
    private readonly GRAPH_WIDTH = 100;
    private readonly GRAPH_HEIGHT = 25;
    private readonly HISTORY_LENGTH = 30;
    private fpsHistory: number[];
    private frameTimeHistory: number[];

    private constructor(renderer: WebGLRenderer) {
        this.renderer = renderer;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.updateInterval = 1000;
        this.visible = true;
        this.fpsHistory = new Array(this.HISTORY_LENGTH).fill(0);
        this.frameTimeHistory = new Array(this.HISTORY_LENGTH).fill(0);

        // Initialize metrics
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            triangles: 0,
            points: 0,
            lines: 0,
            memoryUsage: {
                geometries: 0,
                textures: 0
            },
            jsHeapSize: 0,
            totalJSHeapSize: 0,
            usedJSHeapSize: 0
        };

        // Create container with updated styles
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.bottom = '10px';
        this.container.style.left = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.padding = '4px';
        this.container.style.borderRadius = '3px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'monospace';
        this.container.style.fontSize = '11px';
        this.container.style.zIndex = '1000';
        this.container.style.userSelect = 'none';
        this.container.style.pointerEvents = 'none';
        this.container.style.width = '180px';

        // Create stats container (new separate container for stats)
        const statsContainer = document.createElement('div');
        statsContainer.style.marginBottom = '2px';
        this.container.appendChild(statsContainer);

        // Create graph canvas with updated styles
        this.graphCanvas = document.createElement('canvas');
        this.graphCanvas.width = this.GRAPH_WIDTH;
        this.graphCanvas.height = this.GRAPH_HEIGHT;
        this.graphCanvas.style.marginTop = '2px';
        this.graphCanvas.style.width = `${this.GRAPH_WIDTH}px`;
        this.graphCanvas.style.height = `${this.GRAPH_HEIGHT}px`;
        this.graphCanvas.style.display = 'block';
        this.graphContext = this.graphCanvas.getContext('2d')!;

        // Add toggle button with updated styles
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Hide Performance Stats';
        toggleButton.style.marginTop = '2px';
        toggleButton.style.width = '100%';
        toggleButton.style.padding = '2px';
        toggleButton.style.backgroundColor = '#444';
        toggleButton.style.border = 'none';
        toggleButton.style.color = 'white';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.borderRadius = '2px';
        toggleButton.style.fontSize = '10px';
        toggleButton.style.pointerEvents = 'auto';
        toggleButton.onclick = () => this.toggleVisibility();

        // Append elements in the desired order
        this.container.appendChild(statsContainer);
        this.container.appendChild(this.graphCanvas);
        this.container.appendChild(toggleButton);

        document.body.appendChild(this.container);
    }

    public static getInstance(renderer: WebGLRenderer): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor(renderer);
        }
        return PerformanceMonitor.instance;
    }

    public update(): void {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.frameCount++;

        if (deltaTime >= this.updateInterval) {
            // Calculate FPS
            this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.metrics.frameTime = deltaTime / this.frameCount;

            // Update history
            this.fpsHistory.shift();
            this.fpsHistory.push(this.metrics.fps);
            this.frameTimeHistory.shift();
            this.frameTimeHistory.push(this.metrics.frameTime);

            // Get renderer stats
            const info = this.renderer.info;
            this.metrics.drawCalls = info.render.calls;
            this.metrics.triangles = info.render.triangles;
            this.metrics.points = info.render.points;
            this.metrics.lines = info.render.lines;
            this.metrics.memoryUsage = {
                geometries: info.memory.geometries,
                textures: info.memory.textures
            };

            // Get JS memory stats if available
            if (window.performance && (performance as any).memory) {
                const memoryInfo = (performance as any).memory;
                this.metrics.jsHeapSize = memoryInfo.jsHeapSizeLimit;
                this.metrics.totalJSHeapSize = memoryInfo.totalJSHeapSize;
                this.metrics.usedJSHeapSize = memoryInfo.usedJSHeapSize;
            }

            // Update display
            this.updateDisplay();
            this.drawGraph();

            // Reset counters
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }

    private updateDisplay(): void {
        const formatMemory = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        
        const stats = [
            `Framerate: ${this.metrics.fps} FPS`,
            `Frame Time: ${this.metrics.frameTime.toFixed(1)} ms`,
            `Draw Calls: ${this.metrics.drawCalls}`,
            `Triangles: ${(this.metrics.triangles/1000).toFixed(1)}k`,
            `GPU Memory:`,
            `  Geometries: ${formatMemory(this.metrics.memoryUsage.geometries * 1024)}`,
            `  Textures: ${formatMemory(this.metrics.memoryUsage.textures * 1024)}`
        ];

        // Add JS memory stats if available
        if (this.metrics.usedJSHeapSize > 0) {
            stats.push(
                `JS Memory:`,
                `  Used: ${formatMemory(this.metrics.usedJSHeapSize)}`,
                `  Total: ${formatMemory(this.metrics.totalJSHeapSize)}`,
                `  Limit: ${formatMemory(this.metrics.jsHeapSize)}`
            );
        }

        // Update stats in the existing stats container
        const statsContainer = this.container.firstChild as HTMLDivElement;
        if (statsContainer) {
            statsContainer.style.lineHeight = '1.2';
            statsContainer.innerHTML = stats.join('<br>');
        }
    }

    private drawGraph(): void {
        const ctx = this.graphContext;
        const width = this.GRAPH_WIDTH;
        const height = this.GRAPH_HEIGHT;
        
        // Clear canvas with more transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw target FPS line (60 FPS)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.setLineDash([1, 1]);
        ctx.moveTo(0, height - (60 * height / Math.max(...this.fpsHistory, 60)));
        ctx.lineTo(width, height - (60 * height / Math.max(...this.fpsHistory, 60)));
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw FPS graph with thinner line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 0.5;

        const maxFps = Math.max(...this.fpsHistory, 60);
        const scaleY = height / maxFps;

        this.fpsHistory.forEach((fps, index) => {
            const x = (index / this.HISTORY_LENGTH) * width;
            const y = height - (fps * scaleY);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw frame time graph with thinner line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 0.5;

        const maxFrameTime = Math.max(...this.frameTimeHistory);
        const scaleYFrameTime = height / maxFrameTime;

        this.frameTimeHistory.forEach((frameTime, index) => {
            const x = (index / this.HISTORY_LENGTH) * width;
            const y = height - (frameTime * scaleYFrameTime);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    public toggleVisibility(): void {
        this.visible = !this.visible;
        
        // Get the stats container and graph
        const statsContainer = this.container.firstChild as HTMLDivElement;
        const graph = this.container.children[1] as HTMLCanvasElement;
        
        // Toggle visibility of stats and graph only
        if (statsContainer) statsContainer.style.display = this.visible ? 'block' : 'none';
        if (graph) graph.style.display = this.visible ? 'block' : 'none';
        
        // Update button text
        const button = this.container.querySelector('button');
        if (button) {
            button.textContent = this.visible ? 'Hide Performance Stats' : 'Show Performance Stats';
        }

        // Adjust container width when hidden
        this.container.style.width = this.visible ? '180px' : 'auto';
        this.container.style.backgroundColor = this.visible ? 'rgba(0, 0, 0, 0.5)' : 'transparent';
    }

    public dispose(): void {
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        PerformanceMonitor.instance = null;
    }
} 