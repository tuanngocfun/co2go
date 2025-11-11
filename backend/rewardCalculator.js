/**
 * Reward Calculator Service
 * Implements credible emission factors from UK DESNZ 2024, German UBA 2022,
 * and academic research (Institut Polytechnique de Paris 2023).
 * 
 * References:
 * [1] UK DESNZ 2024 conversion factors (CBP-8826.pdf)
 * [2] German Federal Environment Agency (UBA) 2022 via NAVIT
 * [3] TNMT analysis on e-scooters
 * [4] Institut Polytechnique de Paris 2023 (e-bike life-cycle)
 */

class RewardCalculator {
  constructor() {
    // Credible Emission Factors (grams CO2e per passenger-km)
    // See .github/database_correction_setup.md for full documentation
    this.emissionFactors = {
      car: 177,        // Petrol car, 1 occupant (UK DESNZ 2024) [1]
      car4: 44,        // Petrol car, 4 occupants (UK DESNZ 2024) [1]
      ev_car: 46,      // Electric car, 1 occupant (UK DESNZ 2024) [1]
      bus: 105,        // Average local bus: (UK 108 + German 93) / 2 [1][2]
      coach: 29,       // Long-distance bus: (UK 27 + German 31) / 2 [1][2]
      train: 35,       // Domestic rail (UK DESNZ 2024) [1]
      metro: 60,       // Metro/tram average (German UBA 2022) [2]
      bike: 0,         // Bicycle direct emissions (UBA 2022) [2]
      walk: 0,         // Walking direct emissions (UBA 2022) [2]
      ebike: 13,       // E-bike life-cycle (Polytechnique Insights 2023) [4]
      scooter: 25,     // E-scooter (TNMT analysis) [3]
      motorcycle: 103, // Medium motorcycle (UK DEFRA/BEIS factors)
    };

    // Point calculation parameters
    this.ALPHA = 10; // base points per km
    this.BETA = 2;   // base points per minute
    
    // Emissions bonus: 1 point per 100g CO2e saved
    this.EMISSIONS_BONUS_FACTOR = 100;

    console.log("✅ RewardCalculator initialized with credible emission factors");
    console.log("   Sources: UK DESNZ 2024, German UBA 2022, academic research");
  }

  /**
   * Calculate points earned for a trip
   * New formula: points = base_points + emissions_bonus
   * where:
   *   base_points = (distance_km * ALPHA) + (duration_min * BETA)
   *   emissions_bonus = emissions_saved / EMISSIONS_BONUS_FACTOR
   * 
   * This rewards both trip effort (distance/duration) and environmental benefit
   */
  calculatePoints(mode, distance, duration) {
    // Convert to km and minutes
    const distanceKm = distance / 1000; // meters to km
    const durationMin = duration / 60;  // seconds to minutes

    // Base points from distance and duration
    const basePoints = (distanceKm * this.ALPHA) + (durationMin * this.BETA);

    // Calculate emissions saved vs. driving a petrol car
    const emissionsSaved = this.calculateEmissionsSaved(mode, distance);
    
    // Bonus points: 1 point per 100g CO2e saved
    const emissionsBonus = emissionsSaved / this.EMISSIONS_BONUS_FACTOR;

    // Total points
    const totalPoints = Math.floor(basePoints + emissionsBonus);

    return totalPoints;
  }

  /**
   * Calculate emissions saved compared to driving a car
   * Returns grams of CO2 saved
   */
  calculateEmissionsSaved(mode, distance) {
    const distanceKm = distance / 1000; // meters to km

    // Emissions if this trip was made by a petrol car (reference)
    const carEmissions = distanceKm * this.emissionFactors.car;

    // Emissions for the provided mode (fallback to car factor if unknown)
    const factor = this.getEmissionFactor(mode);
    const modeEmissions = distanceKm * (factor !== null ? factor : this.emissionFactors.car);

    // Saved emissions in grams (never negative)
    const saved = Math.max(0, Math.round(carEmissions - modeEmissions));
    return saved;
  }

  /**
   * Calculate complete trip reward data
   */
  calculateTripReward(mode, distance, duration) {
    const distanceKm = distance / 1000;
    const durationMin = duration / 60;

    const basePoints = Math.floor((distanceKm * this.ALPHA) + (durationMin * this.BETA));
    const emissionsSaved = this.calculateEmissionsSaved(mode, distance);
    const emissionsBonus = Math.floor(emissionsSaved / this.EMISSIONS_BONUS_FACTOR);
    const totalPoints = basePoints + emissionsBonus;

    return {
      pointsEarned: totalPoints,
      emissionsSaved: emissionsSaved,
      breakdown: {
        distanceKm: distanceKm.toFixed(2),
        durationMin: durationMin.toFixed(1),
        basePoints: basePoints,
        emissionsBonus: emissionsBonus,
        emissionsSavedGrams: emissionsSaved,
        finalPoints: totalPoints,
        co2SavedGrams: emissionsSaved,
        co2SavedKg: (emissionsSaved / 1000).toFixed(2),
        formula: `(${distanceKm.toFixed(1)}km × ${this.ALPHA}) + (${durationMin.toFixed(1)}min × ${this.BETA}) + (${emissionsSaved}g ÷ ${this.EMISSIONS_BONUS_FACTOR}) = ${totalPoints} points`
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
    const factor = this.emissionFactors[mode.toLowerCase()];
    return factor !== undefined ? factor : null;
  }

  /**
   * Compare modes for the same trip
   */
  compareModes(distance, duration) {
    const modes = Object.keys(this.emissionFactors);
    const comparisons = modes.map(mode => {
      const reward = this.calculateTripReward(mode, distance, duration);
      const emissionFactor = this.emissionFactors[mode];
      return {
        mode,
        points: reward.pointsEarned,
        emissions: reward.emissionsSaved,
        emissionFactor: emissionFactor,
        breakdown: reward.breakdown,
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
