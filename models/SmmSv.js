const mongoose = require("mongoose");

const smmPanelPartnerSchema = new mongoose.Schema({
    name: { type: String, default: null },
    url_api: { type: String },
    api_token: { type: String },
    price_update: { type: String },
    status: { type: String, enum: ["on", "off"], default: "on" },
    update_price: { type: String, enum: ["on", "off"], default: "on" },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
});
module.exports = mongoose.model('SmmSv', smmPanelPartnerSchema);
