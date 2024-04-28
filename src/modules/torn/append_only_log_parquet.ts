import {ParquetSchema, ParquetWriter, ParquetReader} from 'parquetjs';

// https://www.npmjs.com/package/parquetjs
const schema = new ParquetSchema({
  api_type: { type: 'UTF8' },
  id: { type: 'INT64' },
  datetime: { type: 'INT64' },
  response: { type: 'UTF8' },
});

export async function createAppendOnlyLog() {
    const writer = await ParquetWriter.openFile(schema, '/app/db/torn-api-logs-3.parquet');
    // How often to flush to disk. Usually this would be in the thousands.
    writer.setRowGroupSize(32);
    return new AppendOnlyLog(writer);
}

export class AppendOnlyLog {
  
  constructor(readonly writer: ParquetWriter) {
  }

  async write(apiType: string, id: number, datetime: number, response: string) {
    try {
      const tmpWriter = await ParquetWriter.openFile(schema, '/app/db/torn-api-logs.parquet');
      await tmpWriter.appendRow({api_type: apiType, id, datetime, response});
      await tmpWriter.close();
      await this.writer.appendRow({api_type: apiType, id, datetime, response});
    } catch (e) {
      console.log('Error writing parquet file', e);
    }
  }

  async shutdown() {
    try {
      await this.writer.close();
    } catch (e) {
      console.log('Error closing parquet file', e);
    }
  }

  async stats() {
    try {
      let reader = await ParquetReader.openFile('/app/db/torn-api-logs.parquet');
      // let reader = await ParquetReader.openFile('/app/db/torn-api-logs-3.parquet');
      let cursor = reader.getCursor();
      let record = null;
      let counter = 0;
      while (record = await cursor.next()) {
        counter++;
      }
      console.log('total rows ' + counter);
    } catch (e) {
      console.log(e);
    }
  }
}