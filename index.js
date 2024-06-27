import { Client } from "@xmtp/xmtp-js";
import { Wallet } from "ethers";
import supabase from "./supabase.js";

async function main() {
  var rows = []

  rows = await supabase.from('xmtp_keys')
    .select()
    .then(res => res.data)

  const changes = supabase
    .channel('table-db-changes')
    .on(
      'postgres_changes',
      {
        schema: 'public',
        event: '*',
        table: "xmtp_keys",
      },
      (payload) => {
        console.log(payload.eventType)
        process.exit(1)
      }
    )
    .subscribe()

  await Promise.all(rows.map(async row => {
    console.log(row.keys)
    const keys = Buffer.from(row.keys, 'hex')
    const xmtp = await Client.create(null, {
      env: "production",
      privateKeyOverride: keys,
    });
    console.log(xmtp.address)

    for await (const message of await xmtp.conversations.streamAllMessages()) {
      if (message.senderAddress === xmtp.address) {
        // This message was sent from me
        continue;
      }

      console.log(`New message from ${message.senderAddress}: ${message.content}`);


      await supabase.rpc('insert_log_from_project', {
        owner_addr: row.token_address,
        payload: { message: message.content },
        user_data: { address: message.senderAddress }
      })
    }
  }))

}

import cluster from 'cluster';

if (cluster.isPrimary) {
  cluster.fork();
  cluster.on("exit", (_, code) => {
    console.log(60, code)
    if (code === 2) {
      cluster.fork();
    }
  });
  process.on("SIGINT", () => { });
} else {
  console.log('worker')
  await main()
}

