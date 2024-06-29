
import supabase from "./supabase.js";

async function main(message) {
  if (message.content.startsWith('campaign:')) {

    const [_, campaignId] = message.content.split(':')
    const campaign = await supabase.from('campaigns').select(`*, project:projects(*)`).eq('id', campaignId).single().then(res => res.data)

    await supabase.from('logs').insert({
      project: campaign.project.token_name,
      payload: {
        message: message.content,
        campaign_id: campaignId,
        token_address: campaign.project.token_address
      },
      name: "reply",
      user_data: { address: message.senderAddress.toLowerCase() },
    }).select().single().then(res => console.log(res.data))
  }
}


main({
  content: "campaign:13",
  senderAddress: "0x19951284394050C4C836534999150cF19E924eFC"
})
