const fs = require('fs');

// ---------- LEADS ----------
app.post('/lead', (req,res)=>{
  const {source, handle, intent} = req.body;

  db.run(
    INSERT INTO leads(source,handle,intent,created_at)
     VALUES(?,?,?,datetime('now')),
    [source, handle, intent],
    function(err){
      if(err) return res.status(400).json({error:err.message});
      fs.appendFileSync('D:\BrownEyeCortex\logs\reddit_attribution.log', JSON.stringify({source,handle,intent,ts:Date.now()}) + "\n");
      res.json({ok:true, id:this.lastID});
    }
  );
});
