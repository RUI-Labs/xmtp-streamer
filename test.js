
import supabase from "./supabase.js";

async function main(message) {
        const wallet = await supabase.from('contact_books')
        .select('wallet_address')
        .eq('xmtp_address', message.senderAddress.toLowerCase())
        .single()
        .then(res => res.data?.wallet_address || message.senderAddress)

        console.log(wallet)
}


main({
  content: "campaign:13",
  senderAddress:"0x5f2c6ab93333e67166d848c71f6b9a79cf77821" 
})
