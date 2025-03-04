export class Translation {
  counter: number = 0;

  constructor(private readonly maxLines: number = 3) {

  }

  handleTranslation(chunk: string) {
    console.log('filtering chunk', chunk);
    const output = chunk.split('\n')
      .filter(line => line.indexOf('->') > 0)
      // .slice(0, this.maxLines - this.counter)
      .join('\n')
    // this.counter += output.length;
    return output;
  }
}