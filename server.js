const express=require("express");
const fs=require("fs");
const path=require("path");

const app=express();
app.use(express.json());

const PORT=process.env.PORT||3000;

const DATA=path.join(__dirname,"dreamledger-events.jsonl");

function ledger(event){
    fs.appendFileSync(
        DATA,
        JSON.stringify({
            ts:new Date().toISOString(),
            ...event
        })+"\n"
    );
}

app.get("/",(req,res)=>{
    ledger({
        type:"page_view"
    });

    res.send(`
    <html>
    <head><title>DreamLedger</title></head>
    <body>
    <h1>DreamLedger</h1>
    <p>Reality  Observation  Extraction  Value</p>
    <p>Status: LIVE</p>
    </body>
    </html>
    `);
});


app.get("/health",(req,res)=>{
    res.json({
        ok:true,
        service:"dreamledger",
        version:"2.0.0",
        ts:Date.now()
    });
});


app.post("/event",(req,res)=>{
    ledger({
        type:"event",
        payload:req.body
    });

    res.json({
        ok:true
    });
});


app.listen(PORT,()=>{
    ledger({
        type:"boot",
        port:PORT
    });

    console.log(
        "DreamLedger listening on",
        PORT
    );
});
