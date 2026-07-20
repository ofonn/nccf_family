async function testLiveAPI() {
  const URL = "https://nccf-family.vercel.app/api/rosters";

  console.log("Fetching live data...");
  const getRes = await fetch(URL);
  const data = await getRes.json();
  console.log("Initial state:", data.rosters ? "Exists" : "Empty", "Last Updated:", data.lastUpdated);

  const testPayload = JSON.parse(JSON.stringify(data.rosters));
  testPayload.prayer_roster.title = "Prayer Roster (TESTED)";

  console.log("Sending POST to save...");
  const postRes = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-password': 'nccfadmin'
    },
    body: JSON.stringify(testPayload)
  });

  console.log("POST status:", postRes.status);
  const postText = await postRes.text();
  console.log("POST response:", postText);

  console.log("Fetching again to verify...");
  const getRes2 = await fetch(URL);
  const data2 = await getRes2.json();
  console.log("Final title:", data2.rosters.prayer_roster.title);
}
testLiveAPI();
