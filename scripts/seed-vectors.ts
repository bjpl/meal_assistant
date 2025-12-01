#!/usr/bin/env ts-node
/**
 * Vector Database Seeding Script
 * Seeds meal patterns, ingredients, and knowledge graph
 */

import { runAllSeeders, verifyAllSeeders } from '../src/services/vector/seeders';

async function main() {
  console.log('🚀 Vector Database Seeding Script\n');
  console.log('================================\n');

  try {
    // Run all seeders
    await runAllSeeders();

    console.log('\n================================');
    console.log('🔍 Verifying seeded data...\n');

    // Verify all seeders
    const verified = await verifyAllSeeders();

    if (verified) {
      console.log('\n✅ SUCCESS: All data seeded and verified!');
      process.exit(0);
    } else {
      console.log('\n⚠️  WARNING: Verification failed. Check logs above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ERROR: Seeding failed');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default main;
