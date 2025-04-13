import { BufferAttribute, Float32BufferAttribute } from 'three';

interface PooledBuffer {
    buffer: Float32Array | Uint32Array;
    inUse: boolean;
    size: number;
    lastUsed: number;
}

export class BufferPool {
    private static instance: BufferPool | null = null;
    private pools: Map<string, PooledBuffer[]>;
    private readonly maxPoolSize: number;
    private readonly cleanupThreshold: number;
    private lastCleanup: number;

    private constructor() {
        this.pools = new Map();
        this.maxPoolSize = 10; // Maximum number of buffers to keep in each pool
        this.cleanupThreshold = 60000; // Cleanup unused buffers every 60 seconds
        this.lastCleanup = performance.now();
    }

    public static getInstance(): BufferPool {
        if (!BufferPool.instance) {
            BufferPool.instance = new BufferPool();
        }
        return BufferPool.instance;
    }

    private getPoolKey(type: 'float32' | 'uint32', size: number): string {
        return `${type}_${size}`;
    }

    private createBuffer(type: 'float32' | 'uint32', size: number): Float32Array | Uint32Array {
        return type === 'float32' ? new Float32Array(size) : new Uint32Array(size);
    }

    public acquireBuffer(size: number, type: 'float32' | 'uint32' = 'float32'): Float32Array | Uint32Array {
        this.cleanupIfNeeded();

        const poolKey = this.getPoolKey(type, size);
        let pool = this.pools.get(poolKey);

        if (!pool) {
            pool = [];
            this.pools.set(poolKey, pool);
        }

        // Try to find an available buffer of the right size
        let buffer = pool.find(b => !b.inUse && b.size >= size);
        
        if (!buffer) {
            // Create a new buffer if none available
            buffer = {
                buffer: this.createBuffer(type, size),
                inUse: true,
                size: size,
                lastUsed: performance.now()
            };
            pool.push(buffer);
        } else {
            buffer.inUse = true;
            buffer.lastUsed = performance.now();
        }

        return buffer.buffer;
    }

    public releaseBuffer(buffer: Float32Array | Uint32Array): void {
        for (const [_, pool] of this.pools) {
            const pooledBuffer = pool.find(b => b.buffer === buffer);
            if (pooledBuffer) {
                pooledBuffer.inUse = false;
                pooledBuffer.lastUsed = performance.now();
                return;
            }
        }
    }

    public createBufferAttribute(
        buffer: Float32Array | Uint32Array,
        itemSize: number,
        normalized: boolean = false
    ): BufferAttribute {
        return new Float32BufferAttribute(buffer as Float32Array, itemSize, normalized);
    }

    private cleanupIfNeeded(): void {
        const now = performance.now();
        if (now - this.lastCleanup < this.cleanupThreshold) {
            return;
        }

        for (const [key, pool] of this.pools) {
            // Remove unused buffers that are too old
            const activeBuffers = pool.filter(b => b.inUse || (now - b.lastUsed) < this.cleanupThreshold);
            
            // Keep only the most recently used buffers up to maxPoolSize
            if (activeBuffers.length > this.maxPoolSize) {
                activeBuffers.sort((a, b) => b.lastUsed - a.lastUsed);
                activeBuffers.splice(this.maxPoolSize);
            }

            this.pools.set(key, activeBuffers);
        }

        this.lastCleanup = now;
    }

    public dispose(): void {
        this.pools.clear();
        BufferPool.instance = null;
    }
} 