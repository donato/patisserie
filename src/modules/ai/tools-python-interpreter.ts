import { SessionManager, KernelAPI, KernelManager, ServerConnection}  from '@jupyterlab/services';
import { IExecuteReply, IExecuteReplyMsg } from '@jupyterlab/services/lib/kernel/messages';
import { SessionAPIClient } from '@jupyterlab/services/lib/session/restapi';
import { ISessionConnection } from '@jupyterlab/services/lib/session/session';

// import { XMLHttpRequest } from "xmlhttprequest";
// import WebSocket from 'ws';

// global.XMLHttpRequest = XMLHttpRequest;
// global.WebSocket = WebSocket as any; 


const options = {
  path: 'foo.ipynb',
  type: 'notebook',
  name: 'foo.ipynb',
  kernel: {
    name: 'python'
  }
};

export async function executePython(code:string) {
  // return;
  const serverSettings = ServerConnection.makeSettings({
    baseUrl: 'http://ai-sandbox-executor:8888'
  });
  
  const kernelManager = new KernelManager({serverSettings});

  const k = await kernelManager.startNew();
  const shellFuture = k.requestExecute({code});
  shellFuture.onIOPub = msg => {
    if (msg.header.msg_type !== 'status') {
      const content = msg.content as any;
      if (content.name == 'stdout') {
        console.log(content.text); // note it will have a trailing newline
      }
    }
  };
  const z = await shellFuture.done;
  shellFuture.dispose();
  k.dispose();
}
