const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tropicstay_db';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const userResult = await db.collection('users').updateMany(
    { location: { $exists: true } },
    { $unset: { location: '' } }
  );

  const cursor = db.collection('chalets').find({
    $or: [
      { locationName: { $exists: true } },
      { location: { $exists: false } },
      { location: { $type: 'string' } },
    ],
  });

  const operations = [];
  let skipped = 0;
  for await (const chalet of cursor) {
    const existingLocation = Array.isArray(chalet.location)
      ? chalet.location.filter(value => typeof value === 'string' && value.trim())
      : [];
    const legacyLocation = typeof chalet.locationName === 'string' && chalet.locationName.trim()
      ? [chalet.locationName.trim()]
      : [];
    const location = existingLocation.length ? existingLocation : legacyLocation;

    if (!location.length) {
      skipped += 1;
      continue;
    }

    operations.push({
      updateOne: {
        filter: { _id: chalet._id },
        update: { $set: { location }, $unset: { locationName: '' } },
      },
    });
  }

  const chaletResult = operations.length
    ? await db.collection('chalets').bulkWrite(operations)
    : { modifiedCount: 0 };

  console.log(JSON.stringify({
    usersWithoutLocation: userResult.modifiedCount,
    chaletsMigrated: chaletResult.modifiedCount,
    chaletsWithoutUsableLocation: skipped,
  }));

  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error('Error durante la migración:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
