import { KernelManager, ServerConnection}  from '@jupyterlab/services';


// TODO - figure out how to control python libraries
// TODO - think about best solution for `final_answer` method

export async function executePython(code:string) {
  const serverSettings = ServerConnection.makeSettings({
    baseUrl: 'http://ai-sandbox-executor:8888'
  });
  
  const kernelManager = new KernelManager({serverSettings});

  const k = await kernelManager.startNew();
  const shellFuture = k.requestExecute({code});
  let ioBuffer = '';
  shellFuture.onIOPub = msg => {
    if (msg.header.msg_type !== 'status') {
      const content = msg.content as any;
      if (content.name == 'stdout') {
        // note it will have a trailing newline
        console.log(content.text);
        ioBuffer += content.text;
      }
    }
  };
  const z = await shellFuture.done;
  shellFuture.dispose();
  k.dispose();

  return ioBuffer;
}
