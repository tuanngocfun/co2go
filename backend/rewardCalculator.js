/**
 * Reward Calculator Service
 * Implements DEIRA 2024 emission factors and point calculation formulas
 */

class RewardCalculator {
  constructor() {
    // DEIRA 2024 Emission Factors (grams CO2 per km)
    this.emissionFactors = {
      car: 192,      // Average passenger car
      bus: 89,       // Public bus
      train: 41,     // Urban rail/metro
      bike: 0,       // Bicycle (zero emissions)
      walk: 0,       // Walking (zero emissions)
      ebike: 5,      // Electric bicycle (considering electricity generation)
      scooter: 8,    // Electric scooter
      motorcycle: 103, // Motorcycle
    };

    // Point calculation parameters
    this.ALPHA = 10; // points per km
    this.BETA = 2;   // points per minute
    
    // Bonus multipliers for specific modes
    this.modeMultipliers = {
      walk: 1.2,   // 20% bonus for walking
      bike: 1.1,   // 10% bonus for biking
      ebike: 1.05, // 5% bonus for e-bike
      bus: 1.0,    // No bonus for public transport (baseline)
      train: 1.0,  // No bonus for public transport (baseline)
      scooter: 1.0,
      motorcycle: 0.5, // Reduced points (still better than car)
      car: 0.0,    // No points for driving (comparison baseline)
    };

    console.log("✅ RewardCalculator initialized with DEIRA 2024 factors");
  }

  /**
   * Calculate points earned for a trip
   * Formula: points = (distance_km * ALPHA + duration_min * BETA) * mode_multiplier
   */
  calculatePoints(mode, distance, duration) {
    // Convert to km and minutes
    const distanceKm = distance / 1000; // meters to km
    const durationMin = duration / 60;  // seconds to minutes

    // Base calculation
    const basePoints = (distanceKm * this.ALPHA) + (durationMin * this.BETA);

    // Apply mode multiplier
    const multiplier = this.modeMultipliers[mode.toLowerCase()] || 1.0;
    const points = Math.floor(basePoints * multiplier);

    return points;
  }

  /**
   * Calculate emissions saved compared to driving a car
   * Returns grams of CO2 saved
   */
  calculateEmissionsSaved(mode, distance) {
    const distanceKm = distance / 1000; // meters to km
    
    // Emissions if this trip was made by car
    const carEmissions = distanceKm * this.emissionFactors.car;
    
    // Emissions from actual mode
    const modeEmissions = distanceKm * (this.emissionFactors[mode.toLowerCase()] || 0);
    
    // Emissions saved (difference)
    const saved = Math.floor(carEmissions - modeEmissions);
    
    return Math.max(0, saved); // Never negative
  }

  /**
   * Calculate complete trip reward data
   */
  calculateTripReward(mode, distance, duration) {
    const points = this.calculatePoints(mode, distance, duration);
    const emissionsSaved = this.calculateEmissionsSaved(mode, distance);
    
    return {
      pointsEarned: points,
      emissionsSaved: emissionsSaved,
      breakdown: {
        distanceKm: (distance / 1000).toFixed(2),
        durationMin: (duration / 60).toFixed(1),
        basePoints: Math.floor((distance / 1000) * this.ALPHA + (duration / 60) * this.BETA),
        multiplier: this.modeMultipliers[mode.toLowerCase()] || 1.0,
        finalPoints: points,
        co2SavedGrams: emissionsSaved,
        co2SavedKg: (emissionsSaved / 1000).toFixed(2),
      }
    };
  }

  /**
   * Calculate tier based on total points
   */
  calculateTier(totalPoints) {
    if (totalPoints >= 5000) return "Diamond";
    if (totalPoints >= 2000) return "Gold";
    if (totalPoints >= 500) return "Silver";
    return "Bronze";
  }

  /**
   * Get tier requirements
   */
  getTierRequirements() {
    return [
      { tier: "Bronze", minPoints: 0, maxPoints: 499, color: "#CD7F32" },
      { tier: "Silver", minPoints: 500, maxPoints: 1999, color: "#C0C0C0" },
      { tier: "Gold", minPoints: 2000, maxPoints: 4999, color: "#FFD700" },
      { tier: "Diamond", minPoints: 5000, maxPoints: Infinity, color: "#B9F2FF" },
    ];
  }

  /**
   * Calculate progress to next tier
   */
  getTierProgress(totalPoints) {
    const tiers = this.getTierRequirements();
    const currentTier = tiers.find(t => totalPoints >= t.minPoints && totalPoints <= t.maxPoints);
    
    if (!currentTier) {
      return null;
    }

    const nextTier = tiers.find(t => t.minPoints > totalPoints);
    
    if (!nextTier) {
      // Already at highest tier
      return {
        currentTier: currentTier.tier,
        progress: 100,
        pointsToNext: 0,
        nextTier: null,
      };
    }

    const pointsInCurrentTier = totalPoints - currentTier.minPoints;
    const pointsNeededForNext = nextTier.minPoints - currentTier.minPoints;
    const progress = Math.floor((pointsInCurrentTier / pointsNeededForNext) * 100);

    return {
      currentTier: currentTier.tier,
      nextTier: nextTier.tier,
      progress: progress,
      pointsToNext: nextTier.minPoints - totalPoints,
      currentPoints: totalPoints,
    };
  }

  /**
   * Validate trip data
   */
  validateTripData(mode, distance, duration) {
    const errors = [];

    // Validate mode
    const validModes = Object.keys(this.emissionFactors);
    if (!validModes.includes(mode.toLowerCase())) {
      errors.push(`Invalid mode. Must be one of: ${validModes.join(", ")}`);
    }

    // Validate distance (must be positive and reasonable)
    if (distance <= 0) {
      errors.push("Distance must be greater than 0");
    }
    if (distance > 500000) { // 500 km seems like a reasonable max for a single trip
      errors.push("Distance seems unreasonably high (max 500km)");
    }

    // Validate duration (must be positive and reasonable)
    if (duration <= 0) {
      errors.push("Duration must be greater than 0");
    }
    if (duration > 86400) { // 24 hours
      errors.push("Duration seems unreasonably high (max 24 hours)");
    }

    // Validate speed (distance/duration ratio)
    const distanceKm = distance / 1000;
    const durationHours = duration / 3600;
    const averageSpeed = distanceKm / durationHours;

    // Different speed limits for different modes
    const speedLimits = {
      walk: 10,       // Max 10 km/h
      bike: 40,       // Max 40 km/h
      ebike: 45,      // Max 45 km/h
      scooter: 35,    // Max 35 km/h
      bus: 80,        // Max 80 km/h
      train: 200,     // Max 200 km/h
      motorcycle: 150,// Max 150 km/h
      car: 150,       // Max 150 km/h
    };

    const maxSpeed = speedLimits[mode.toLowerCase()] || 100;
    if (averageSpeed > maxSpeed) {
      errors.push(`Average speed (${averageSpeed.toFixed(1)} km/h) exceeds maximum for ${mode} (${maxSpeed} km/h)`);
    }

    return {
      valid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Get emission factor for a mode
   */
  getEmissionFactor(mode) {
    return this.emissionFactors[mode.toLowerCase()] || null;
  }

  /**
   * Get all emission factors
   */
  getAllEmissionFactors() {
    return { ...this.emissionFactors };
  }

  /**
   * Compare modes for the same trip
   */
  compareModes(distance, duration) {
    const modes = Object.keys(this.emissionFactors);
    const comparisons = modes.map(mode => {
      const reward = this.calculateTripReward(mode, distance, duration);
      return {
        mode,
        points: reward.pointsEarned,
        emissions: reward.emissionsSaved,
        multiplier: this.modeMultipliers[mode],
      };
    });

    return comparisons.sort((a, b) => b.points - a.points);
  }

  /**
   * Calculate environmental impact summary
   */
  calculateEnvironmentalImpact(totalEmissionsSaved) {
    // Convert to kg
    const kg = totalEmissionsSaved / 1000;
    
    // Equivalent trees needed to absorb this CO2 (1 tree absorbs ~21kg CO2/year)
    const treesEquivalent = (kg / 21).toFixed(1);
    
    // Equivalent km driven by car
    const carKmEquivalent = (kg / 0.192).toFixed(0); // 192g/km
    
    // Equivalent liters of gasoline (2.3kg CO2 per liter)
    const gasEquivalent = (kg / 2.3).toFixed(1);

    return {
      totalKg: kg.toFixed(2),
      treesEquivalent,
      carKmEquivalent,
      gasEquivalent,
      message: `You've saved ${kg.toFixed(1)}kg of CO2 - equivalent to ${treesEquivalent} trees absorbing CO2 for a year!`
    };
  }
}

// Export singleton instance
module.exports = new RewardCalculator();

// Example usage
if (require.main === module) {
  const calculator = new RewardCalculator();
  
  // Test calculation
  const trip = {
    mode: "bike",
    distance: 5000,  // 5 km
    duration: 1200,  // 20 minutes
  };
  
  const validation = calculator.validateTripData(trip.mode, trip.distance, trip.duration);
  console.log("Validation:", validation);
  
  if (validation.valid) {
    const reward = calculator.calculateTripReward(trip.mode, trip.distance, trip.duration);
    console.log("\nReward Calculation:");
    console.log(reward);
    
    const tier = calculator.calculateTier(500);
    console.log("\nTier:", tier);
    
    const progress = calculator.getTierProgress(500);
    console.log("\nTier Progress:", progress);
    
    const comparison = calculator.compareModes(5000, 1200);
    console.log("\nMode Comparison:");
    comparison.forEach(c => {
      console.log(`${c.mode}: ${c.points} points, ${c.emissions}g CO2 saved`);
    });
  }
}
