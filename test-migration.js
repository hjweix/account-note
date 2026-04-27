
// ============================================================================
// DATA MIGRATION TEST SCRIPT
// Purpose: Test data migration functionality with various data scenarios
// ============================================================================

/**
 * Test Case 1: Old format data (from v1.0 - January 2025)
 * Structure: Only basic fields, no tags/isFavorite/favoriteTime
 */
const oldFormatData = {
  "https_example.com_admin": {
    key: "https_example.com_admin",
    domain: "https://example.com",
    username: "admin",
    note: "This is an old format note",
    createTime: "2025-01-09T10:00:00.000Z",
    updateTime: "2025-01-09T10:00:00.000Z"
    // Note: No tags, isFavorite, or favoriteTime fields
  }
};

/**
 * Test Case 2: Partial new format data (from early v2.0)
 * Structure: Has some new fields but missing others
 */
const partialNewFormatData = {
  "https_test.com_user": {
    key: "https_test.com_user",
    domain: "https://test.com",
    username: "user123",
    note: "Partial format note",
    createTime: "2025-03-01T15:30:00.000Z",
    updateTime: "2025-03-01T15:30:00.000Z",
    tags: ["work"],
    // Note: Missing isFavorite and favoriteTime
  }
};

/**
 * Test Case 3: Complete new format data (current version)
 * Structure: All fields present
 */
const completeNewFormatData = {
  "https_demo.com_tester": {
    key: "https_demo.com_tester",
    domain: "https://demo.com",
    username: "tester",
    note: "Complete format note",
    createTime: "2025-04-01T09:00:00.000Z",
    updateTime: "2025-04-01T09:00:00.000Z",
    tags: ["personal", "important"],
    isFavorite: true,
    favoriteTime: "2025-04-01T10:00:00.000Z"
  }
};

/**
 * Test Case 4: Mixed data scenario (all types combined)
 * Structure: Multiple notes in different formats
 */
const mixedFormatData = {
  ...oldFormatData,
  ...partialNewFormatData,
  ...completeNewFormatData,
  // Add one more old format without key field
  "https_legacy.com_olduser": {
    domain: "https://legacy.com",
    username: "olduser",
    note: "Very old format without key field",
    createTime: "2025-01-05T08:00:00.000Z",
    updateTime: "2025-01-05T08:00:00.000Z"
  }
};

/**
 * Expected results after migration
 */
const expectedResults = {
  "https_example.com_admin": {
    key: "https_example.com_admin",
    domain: "https://example.com",
    username: "admin",
    note: "This is an old format note",
    createTime: "2025-01-09T10:00:00.000Z",
    updateTime: "2025-01-09T10:00:00.000Z",
    tags: [],
    isFavorite: false,
    favoriteTime: null
  },
  "https_test.com_user": {
    key: "https_test.com_user",
    domain: "https://test.com",
    username: "user123",
    note: "Partial format note",
    createTime: "2025-03-01T15:30:00.000Z",
    updateTime: "2025-03-01T15:30:00.000Z",
    tags: ["work"],
    isFavorite: false,
    favoriteTime: null
  },
  "https_demo.com_tester": {
    key: "https_demo.com_tester",
    domain: "https://demo.com",
    username: "tester",
    note: "Complete format note",
    createTime: "2025-04-01T09:00:00.000Z",
    updateTime: "2025-04-01T09:00:00.000Z",
    tags: ["personal", "important"],
    isFavorite: true,
    favoriteTime: "2025-04-01T10:00:00.000Z"
  },
  "https_legacy.com_olduser": {
    key: "https_legacy.com_olduser",  // Should be added
    domain: "https://legacy.com",
    username: "olduser",
    note: "Very old format without key field",
    createTime: "2025-01-05T08:00:00.000Z",
    updateTime: "2025-01-05T08:00:00.000Z",
    tags: [],
    isFavorite: false,
    favoriteTime: null
  }
};

// Export test data
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    oldFormatData,
    partialNewFormatData,
    completeNewFormatData,
    mixedFormatData,
    expectedResults
  };
}

console.log('Test data loaded successfully');
console.log('Old format entries:', Object.keys(oldFormatData).length);
console.log('Partial new format entries:', Object.keys(partialNewFormatData).length);
console.log('Complete new format entries:', Object.keys(completeNewFormatData).length);
console.log('Mixed format entries:', Object.keys(mixedFormatData).length);
