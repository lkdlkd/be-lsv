const Bank = require('../models/Bank');

exports.createBank = async (req, res) => {
    try {
        const bank = new Bank(req.body);
        await bank.save();
        res.status(201).json(bank);
        console.log(bank)
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
    
};

exports.updateBank = async (req, res) => {
    try {
        const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!bank) return res.status(404).json({ message: 'Bank not found' });
        res.json(bank);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteBank = async (req, res) => {
    try {
        const bank = await Bank.findByIdAndDelete(req.params.id);
        if (!bank) return res.status(404).json({ message: 'Bank not found' });
        res.json({ message: 'Bank deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getBank = async (req, res) => {
    try {
        let banks;
        // Nếu người dùng là admin, hiển thị tất cả các trường
        if (req.user && req.user.role === "admin") {
            banks = await Bank.find();
        } else {
            // Ngược lại, ẩn các trường nhạy cảm
            banks = await Bank.find().select("-bank_account -bank_password -token");
        }

        if (!banks || banks.length === 0) {
            return res.status(404).json({ message: 'Bank not found' });
        }
        res.json(banks);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

