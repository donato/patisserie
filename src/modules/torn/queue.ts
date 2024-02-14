export interface StreamInterface {
  add(route: string, data: Object): void;
  read(route: string, index: number): Object;
}

export interface ConsumerInterface {
  read(route: string): Object | null;
  acknowledge(route: string, id:number): void;
}

// todo: use redis for queue
export class LocalStreamImpl implements StreamInterface{
  constructor(private readonly q : {[key: string]: Object[]} = {}) {}

  add(route: string, data: Object): void {
    console.log(`Adding to queue ${route}:${JSON.stringify(data)}`);
    this.q[route] = this.q[route] || [];
    this.q[route].push(data);
  }

  read(route: string, index: number): Object {
    return this.q[route]?.[index];
  }
}

export class LocalConsumerImpl implements ConsumerInterface {
  constructor(readonly stream: StreamInterface, private pending: {[key: string]: number[]} = {}, private lastReadId: {[key: string]: number} = {}) {}

  read(route: string): Object | null {
    const index = (route in this.lastReadId) ? this.lastReadId[route] + 1 : 0;
    this.pending[route] = this.pending[route] || [];
    this.pending[route].push(index)
    const result = this.stream.read(route, index);
    if (!result) {
      return null;
    }
    this.lastReadId[route] = index;
    return result;
  }

  acknowledge(route: string, id: number):void {
    this.pending[route].splice(this.pending[route].indexOf(id), 1);
  }
}