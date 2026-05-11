class MinHeap {
    constructor() {
      this.heap = [];
    }
  
    insert(item) {
      this.heap.push(item);
      this.heapifyUp(this.heap.length - 1);
    }
  
    extractMin() {
      if (this.heap.length === 0) return null;
      const min = this.heap[0];
      const last = this.heap.pop();
      if (this.heap.length > 0) {
        this.heap[0] = last;
        this.heapifyDown(0);
      }
      return min;
    }
  
    heapifyUp(index) {
      let currentIndex = index;
      while (currentIndex > 0) {
        const parentIndex = Math.floor((currentIndex - 1) / 2);
        if (this.heap[parentIndex].timestamp > this.heap[currentIndex].timestamp) {
          this.swap(parentIndex, currentIndex);
          currentIndex = parentIndex;
        } else {
          break;
        }
      }
    }
  
    heapifyDown(index) {
      let currentIndex = index;
      while (true) {
        const leftChildIndex = 2 * currentIndex + 1;
        const rightChildIndex = 2 * currentIndex + 2;
        let smallestIndex = currentIndex;
  
        if (leftChildIndex < this.heap.length && this.heap[leftChildIndex].timestamp < this.heap[smallestIndex].timestamp) {
          smallestIndex = leftChildIndex;
        }
  
        if (rightChildIndex < this.heap.length && this.heap[rightChildIndex].timestamp < this.heap[smallestIndex].timestamp) {
          smallestIndex = rightChildIndex;
        }
  
        if (smallestIndex !== currentIndex) {
          this.swap(currentIndex, smallestIndex);
          currentIndex = smallestIndex;
        } else {
          break;
        }
      }
    }
  
    swap(i, j) {
      const temp = this.heap[i];
      this.heap[i] = this.heap[j];
      this.heap[j] = temp;
    }
  
    size() {
      return this.heap.length;
    }
  }

  module.exports = MinHeap