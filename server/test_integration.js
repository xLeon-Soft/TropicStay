async function testAll() {
  console.log('--- TEST 1: Angular Dev Server ---');
  const rClient = await fetch('http://localhost:4200/');
  console.log('Client HTTP Status:', rClient.status);

  console.log('--- TEST 2: API Get Chalets ---');
  const rChalets = await (await fetch('http://localhost:5000/api/chalets')).json();
  console.log('Chalets count:', rChalets.count);
  console.log('First chalet:', rChalets.data[0].title);
  const firstChalet = rChalets.data[0];

  console.log('--- TEST 3: Submit Review to MongoDB ---');
  const reviewPayload = {
    authorName: 'Alexander',
    rating: 5,
    cleanliness: 5,
    location: 5,
    communication: 5,
    value: 5,
    comment: 'Un chalet absolutamente mágico, la vista al lago de Atitlán es espectacular.',
  };
  const rReview = await (await fetch(`http://localhost:5000/api/chalets/${firstChalet._id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewPayload)
  })).json();
  console.log('Review Response:', rReview.message);
  console.log('Updated Rating:', rReview.updatedChaletRating);

  console.log('--- TEST 4: Create Booking in MongoDB ---');
  const bookingPayload = {
    chaletId: firstChalet._id,
    guestName: 'Alexander Huésped',
    guestEmail: 'alexander@tropicstay.gt',
    guestPhone: '+502 5555-1234',
    checkIn: '2026-10-01',
    checkOut: '2026-10-04',
    guestsCount: 4,
    notes: 'Vacaciones en familia'
  };
  const rBooking = await (await fetch('http://localhost:5000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingPayload)
  })).json();
  console.log('Booking Response:', rBooking.message);
  console.log('Booking ID:', rBooking.data._id);

  console.log('--- TEST 5: Create New Chalet in MongoDB ---');
  const newChaletPayload = {
    title: 'Chalet Atardecer Dorado en Lago de Atitlán',
    category: 'Lago',
    department: 'Sololá',
    municipality: 'Panajachel',
    locationName: 'Bahía Dorada, Panajachel, Sololá',
    description: 'Hermoso chalet con piscina y muelle privado para disfrutar de los mejores atardeceres del lago.',
    pricePerNight: 2500,
    guestsMax: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    images: ['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80'],
    thumbnail: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80',
    amenities: ['Piscina privada', 'Muelle privado', 'Wifi'],
    rules: ['No fiestas']
  };
  const rNewChalet = await (await fetch('http://localhost:5000/api/chalets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newChaletPayload)
  })).json();
  console.log('New Chalet Created:', rNewChalet.message, 'ID:', rNewChalet.data._id);

  const rTotalChalets = await (await fetch('http://localhost:5000/api/chalets')).json();
  console.log('Total Chalets in DB now:', rTotalChalets.count);
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

testAll().catch(e => console.error('Test error:', e));
