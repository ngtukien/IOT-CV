/**
 * Vòng đệm cỡ cố định: đầy thì ghi đè phần tử CŨ NHẤT. Không cấp phát lại mảng
 * mỗi lần ghi — telemetry về 8 Hz suốt buổi bay, `[...arr, x].slice()` ở nhịp đó
 * là rác cho bộ thu gom mỗi 125 ms.
 */
export class RingBuffer<T> {
  readonly capacity: number;
  private readonly items: (T | undefined)[];
  private head = 0; // chỗ ghi kế tiếp
  private count = 0;

  constructor(capacity: number) {
    if (!(capacity > 0) || !Number.isInteger(capacity)) throw new Error(`RingBuffer: capacity phải là số nguyên dương, nhận ${capacity}`);
    this.capacity = capacity;
    this.items = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.count;
  }

  push(item: T): void {
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count += 1;
  }

  /** Phần tử thứ `i` tính từ CŨ NHẤT (0) tới mới nhất (size-1). */
  at(i: number): T | undefined {
    if (i < 0 || i >= this.count) return undefined;
    const start = (this.head - this.count + this.capacity) % this.capacity;
    return this.items[(start + i) % this.capacity];
  }

  last(): T | undefined {
    return this.at(this.count - 1);
  }

  /** Bản sao cũ → mới. */
  toArray(): T[] {
    const out: T[] = new Array(this.count);
    for (let i = 0; i < this.count; i += 1) out[i] = this.at(i) as T;
    return out;
  }

  clear(): void {
    this.items.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}
