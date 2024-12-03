type Listener<T> = (data: T) => void;

class ObservableValue<T> {
  private _value: T;
  private listeners: Listener<T>[] = [];

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue;
      this.emit(newValue);
    }
  }

  private emit(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  public subscribe(listener: Listener<T>): void {
    this.listeners.push(listener);
  }

  public unsubscribe(listener: Listener<T>): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  public unsubscribeAll(): void {
    this.listeners = [];
  }
}

export default ObservableValue;
