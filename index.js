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
        process.exit(2)
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

      console.log({
        owner_addr: row.address,
        payload: { message: message.content },
        user_data: { address: message.senderAddress }
      })

      if (message.content && message.content.startsWith('echo')) {
        await message.conversation.send(message.content.slice(5))
      }

      if (message.content && message.content.startsWith('campaign:')) {

        const [_, campaignId] = message.content.split(':')
        const campaign = await supabase.from('campaigns').select(`*, project:projects(*)`).eq('id', campaignId).single().then(res => res.data)

        const wallet = await supabase.from('contact_books')
        .select('wallet_address')
        .eq('xmtp_address', message.senderAddress.toLowerCase())
        .single()
        .then(res => res.data?.wallet_address || message.senderAddress)

        await supabase.from('logs').insert({
          project: campaign.project.token_name,
          payload: {
            message: message.content,
            campaign: campaignId,
            token_address: campaign.project.token_address
          },
          name: "reply",
          user_data: { address: wallet.toLowerCase() },
        })
        .select()
        .single()
        .then(res => console.log(res.data))
      }

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
