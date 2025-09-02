const express = require("express");
const SellingPartnerAPI = require("amazon-sp-api");

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

app.get("/", (req, res) => {
  const date = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  res.json({ date: date });
});

app.post("/", async (req, res) => {
  try {
    const result = await routes(req.body);
    console.log("doPost out:" + JSON.stringify(result));
    res.json(result);
  } catch (error) {
    console.log("doPost error:" + error.message);
    res.status(400).json({ error: error.message }); // 400 Bad Request for invalid pathInfo
  }
});

async function routes(e) {
  if (e.pathInfo === "checkstock") {
    return await checkstock(e);
  } else {
    throw new Error("Invalid pathInfo");
  }
}

async function checkstock(e) {
  try {
    let sellingPartner = new SellingPartnerAPI({
      region: "fe", // Important: "fe" for Far East region
      refresh_token: e.apiKey.refreshtoken,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: e.apiKey.clientid,
        SELLING_PARTNER_APP_CLIENT_SECRET: e.apiKey.clientsecret,
        AWS_ACCESS_KEY_ID: e.apiKey.awssecret,
        AWS_SECRET_ACCESS_KEY: e.apiKey.awsaccess,
        AWS_SELLING_PARTNER_ROLE: e.apiKey.awsarn,
      },
    });

    let result = await sellingPartner.callAPI({
      operation: "getCompetitivePricing",
      endpoint: "productPricing",
      query: {
        MarketplaceId: "A1VC38T7YXB528", // This is the marketplace ID for Japan
        Asins: e.itemType === "Asin" ? e.ids.join(",") : undefined,
        Skus: e.itemType === "Sku" ? e.ids.join(",") : undefined,
        ItemType: e.itemType,
      },
    });

    console.log("SP-API Response:", JSON.stringify(result)); // Log the raw response

    let totalCount = sumCountsByCriteria(result, e.criteria);
    console.log("Total count:", totalCount);
    return { ok: totalCount <= 0 };
  } catch (error) {
    console.error("SP-API Error:", error);
    throw new Error("SP-API call failed: " + error.message);
  }
}

/**
 * Amazon SP-APIを使用して商品の在庫数を集計する関数
 * @param {Object} response - Amazon SP-API Item情報を含むオブジェクト
 * @param {string[]} criteria - 確認する商品の状態（New, Used, Collectible）
 * @return {Object[]} 各商品IDに対する在庫確認結果の配列
 */
function sumCountsByCriteria(result, criteria) {
  let totalCount = 0;

  try {
    if (!Array.isArray(result) || result.length === 0) {
      console.warn("Invalid result:", result);
      return 0;
    }

    const numberOfOfferListings = result[0]?.Product?.CompetitivePricing?.NumberOfOfferListings;

    if (!Array.isArray(numberOfOfferListings)) {
      console.warn("NumberOfOfferListings is missing or not an array:", numberOfOfferListings);
      return 0;
    }

    criteria.forEach((condition) => {
      const offer = numberOfOfferListings.find(
        (offer) => offer.condition?.toLowerCase() === condition.toLowerCase()
      );
      if (offer) {
        totalCount += parseFloat(offer.Count);
      }
    });
  } catch (error) {
    console.error("Error in sumCountsByCriteria:", error);
    return 0;
  }

  return totalCount;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));