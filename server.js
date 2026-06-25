const express=require("express");
const fs=require("fs");
const path=require("path");
const Stripe=require("stripe");

const app=express();

const PORT=process.env.PORT||3000;

const EVENTS=path.join(__dirname,"dreamledger-ledger.jsonl");

function writeLedger(event){
    fs.appendFileSync(
        EVENTS,
        JSON.stringify({
            ts:new Date().toISOString(),
            ...event
        })+"\n"
    );
}

app.use(express.json());

const PRODUCTS=[
    {
        id:"commander-upgrade",
        name:"Commander Deck Upgrade",
        price:19,
        description:"Optimization report and upgrade path."
    },
    {
        id:"deck-audit",
        name:"Commander Deck Audit",
        price:9,
        description:"Fast deck review."
    }
];

app.get("/products.json",(req,res)=>{
    res.json({
        products:PRODUCTS
    });
});

app.post("/checkout/:id",(req,res)=>{

    const product=PRODUCTS.find(
        p=>p.id===req.params.id
    );

    if(!product){
        return res.status(404).json({
            error:"product_missing"
        });
    }

    writeLedger({
        type:"checkout_intent",
        product:product.id,
        price:product.price
    });

    res.json({
        ok:true,
        next:"stripe_checkout",
        product
    });
});


app.post("/event",(req,res)=>{

    writeLedger({
        type:"event",
        payload:req.body
    });

    res.json({
        ok:true
    });
});


app.get("/health",(req,res)=>{
    res.json({
        ok:true,
        service:"dreamledger",
        version:"2.1.0",
        ts:Date.now()
    });
});


app.listen(PORT,()=>{
    writeLedger({
        type:"boot",
        port:PORT
    });

    console.log(
        "DreamLedger listening",
        PORT
    );
});
