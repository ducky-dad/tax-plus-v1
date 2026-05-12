import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOP = "juul-shop.myshopify.com";
const FUNCTION_ID = "019e1ae2-e579-7f15-98c2-58c3a4b5022e";

async function main() {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });

  if (!session) {
    console.error("No offline session found for", SHOP);
    process.exit(1);
  }

  console.log("Found session, access token:", session.accessToken.slice(0, 10) + "...");

  const response = await fetch(
    `https://${SHOP}/admin/api/2026-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `
          mutation cartTransformCreate($functionId: String!) {
            cartTransformCreate(functionId: $functionId) {
              cartTransform {
                id
                functionId
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: { functionId: FUNCTION_ID },
      }),
    }
  );

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
