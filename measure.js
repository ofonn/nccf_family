const t1 = Date.now();
fetch("https://nccf-family.vercel.app/api/rosters")
  .then(res => res.json())
  .then(data => {
    console.log("Vercel API GET Time:", Date.now() - t1, "ms");
  })
  .catch(err => console.error("Error:", err));
