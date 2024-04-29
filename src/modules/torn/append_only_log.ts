import * as pino from "pino";

// const pinox = pino.default();
const filePath = '/app/db/torn-pino.log';

export async function createAppendOnlyLog() {
    return new AppendOnlyLog();
}

export class AppendOnlyLog {
  private logger: any;
  
  constructor() {
    const transport = pino.transport({
      target: 'pino/file',
      options: { destination: filePath, append: true }
    })
    this.logger = pino.pino(transport)
  }

  async write(apiType: string, id: number, datetime: number, response: string) {
    // hi
    try {
      this.logger.info({
        apiType, id, response
      });
    } catch (e) {
      console.log('Error writing log', e);
    }
  }

  async shutdown() {
    try {
      // await this.writer.close();
    } catch (e) {
      console.log('Error closing file', e);
    }
  }

  async stats() {
    // try {
    //   let reader = await ParquetReader.openFile('/app/db/torn-api-logs.parquet');
    //   // let reader = await ParquetReader.openFile('/app/db/torn-api-logs-3.parquet');
    //   let cursor = reader.getCursor();
    //   let record = null;
    //   let counter = 0;
    //   while (record = await cursor.next()) {
    //     counter++;
    //   }
    //   console.log('total rows ' + counter);
    // } catch (e) {
    //   console.log(e);
    // }
  }
}