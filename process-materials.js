const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://pakman4990:mWCHCDkm0Hm1A0Dw@cluster0-shard-00-00.0f8dm.mongodb.net:27017,cluster0-shard-00-01.0f8dm.mongodb.net:27017,cluster0-shard-00-02.0f8dm.mongodb.net:27017/?ssl=true&replicaSet=atlas-jkjng4-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

async function processMaterials() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");
    
    const db = mongoose.connection.db;
    
    // Get all lectures with materials that need processing
    const lectures = await db.collection('lectures').find({
      'materials.0': { $exists: true }
    }).toArray();
    
    console.log(`\n📚 Found ${lectures.length} lectures with materials`);
    
    let processedCount = 0;
    let totalMaterials = 0;
    
    for (const lecture of lectures) {
      console.log(`\n🔍 Processing lecture: ${lecture.title || 'Untitled'} (${lecture._id})`);
      
      if (!lecture.materials || lecture.materials.length === 0) continue;
      
      for (const material of lecture.materials) {
        totalMaterials++;
        
        // Skip materials that already have content
        if (material.content && material.content.trim().length > 0) {
          console.log(`   ✅ Material "${material.title}" already has content (${material.content.length} chars)`);
          continue;
        }
        
        console.log(`   🔄 Processing material "${material.title}" (${material.fileType})`);
        
        try {          // Make API call to process the material
          const response = await fetch(`http://localhost:3000/api/lectures/${lecture._id}/materials/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              materialId: material._id.toString(),
              force: false
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`   ✅ Successfully processed: ${result.chunksCreated} chunks created`);
            processedCount++;
          } else {
            const error = await response.json();
            console.log(`   ❌ Failed to process: ${error.error || 'Unknown error'}`);
          }
          
        } catch (error) {
          console.log(`   ❌ Network error: ${error.message}`);
        }
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n📊 Processing Summary:`);
    console.log(`   Total materials found: ${totalMaterials}`);
    console.log(`   Materials processed: ${processedCount}`);
    console.log(`   Processing complete!`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Helper function to wait for server to be ready
async function waitForServer() {
  console.log("🔍 Checking if user server is running...");
  
  for (let i = 0; i < 10; i++) {    try {
      const response = await fetch('http://localhost:3000/api/health');
      if (response.ok) {
        console.log("✅ User server is ready");
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    console.log(`   Waiting... (${i + 1}/10)`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("❌ Server not responding. Please make sure the user server is running on port 3000");
  return false;
}

async function main() {
  console.log("🚀 Starting material processing...");
  
  // Check if server is running
  const serverReady = await waitForServer();
  if (!serverReady) {
    process.exit(1);
  }
  
  // Process materials
  await processMaterials();
}

main();
