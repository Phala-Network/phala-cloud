import arg from "arg";
import { createClient } from "@phala/cloud/create-client";

const typed: Parameters<typeof arg>[0] = {};

async function main(_: arg.Result<typeof typed>) {
  const client = createClient();
  const { nodes, kms_list } = await client.getAvailableNodes();

  for (const node of nodes) {
    console.log(`${node.name} (${node.region_identifier})`);
    console.log(`teepod_id: ${node.teepod_id_hashid ?? "unavailable"}`);
    console.log(`node_id: ${node.node_id_hashid ?? "unavailable"}`);
    if (node.fmspc) {
      console.log(`fmspc: ${node.fmspc}`);
    }
    if (node.device_id) {
      console.log(`device_id: ${node.device_id}`);
    }
    const supported_kms = node.kms_list.map((slug) => kms_list.find((k) => k.slug === slug));
    if (supported_kms.length > 0) {
      console.log("Supported KMS:");
      for (const kms of supported_kms) {
        if (kms?.slug === node.default_kms) {
          console.log(`  - ${kms?.slug} (default)`);
        } else {
          console.log(`  - ${kms?.slug}`);
        }
      }
    }
    const supported_os_images = node.images.map((image) => image.name);
    if (supported_os_images.length > 0) {
      console.log("Supported OS Images:");
      for (const image of supported_os_images) {
        console.log(`  - ${image}`);
      }
    }
    console.log("");
  }
}

main(arg(typed)).catch(console.error);
