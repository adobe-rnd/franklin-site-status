const { MongoClient, ObjectID } = require('mongodb');

async function migrateAudits() {
  const client = new MongoClient('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('franklin-status'); // Replace with your database name

    const sitesCollection = db.collection('sites');
    const auditsCollection = db.collection('audits');

    // Create the audits collection if it doesn't exist
    await auditsCollection.createIndex({ site: 1 }); // Create an index for the reference

    // Find all documents in the sites collection
    const sitesDocuments = await sitesCollection.find({}).toArray();

    // Loop through each site document and migrate audits
    for (const siteDocument of sitesDocuments) {
      const siteId = siteDocument._id;

      if (siteDocument.audits && Array.isArray(siteDocument.audits)) {
        const bulkOps = [];

        for (const audit of siteDocument.audits) {

          // Include the audit content at the root level
          const newAuditDocument = {
            siteId: new ObjectID(siteId),
            ...audit, // Spread the audit content
          };

          bulkOps.push({ insertOne: { document: newAuditDocument } });
        }

        // Perform the bulk insert
        if (bulkOps.length > 0) {
          await auditsCollection.bulkWrite(bulkOps);
          console.log(`Inserted ${bulkOps.length} audit documents for ${siteDocument.domain}`);
        }
      }

      // Remove the audits field from the site document
      // await sitesCollection.updateOne({ _id: siteId }, { $unset: { audits: '' } });
    }

    console.log('Data migration completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

migrateAudits();
