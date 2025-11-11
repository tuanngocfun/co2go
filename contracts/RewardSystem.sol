// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract RewardSystem {
    // Structs
    struct Trip {
        uint256 tripId;
        address user;
        string mode; // "walk", "bike", "bus", "train"
        uint256 distance; // meters
        uint256 duration; // seconds
        uint256 pointsEarned;
        uint256 emissionsSaved; // grams CO2
        uint256 timestamp;
        bytes32 tripHash;
    }

    struct Redemption {
        uint256 redemptionId;
        address user;
        string rewardId;
        uint256 pointsCost;
        uint256 timestamp;
        bytes32 txHash;
    }

    struct Reward {
        string rewardId;
        string name;
        uint256 pointsCost;
        bool active;
    }

    // State variables
    mapping(address => uint256) public pointsBalance;
    mapping(address => Trip[]) public userTrips;
    mapping(address => Redemption[]) public userRedemptions;
    mapping(bytes32 => bool) public tripExists;
    mapping(address => mapping(uint256 => bool)) public tripIdUsed;
    mapping(string => Reward) public rewardCatalog;
    
    uint256 public totalTrips;
    uint256 public totalRedemptions;
    uint256 public totalPointsIssued;
    
    // Emission factors (DEIRA 2024) - grams CO2 per km
    mapping(string => uint256) public emissionFactors;
    
    // Reward calculation parameters
    uint256 public constant ALPHA = 10; // points per km
    uint256 public constant BETA = 2;   // points per minute
    uint256 public constant EMISSIONS_BONUS_FACTOR = 100; // 1 point per 100g CO2 saved
    
    address public owner;

    // Events
    event TripRecorded(
        address indexed user,
        uint256 indexed tripId,
        string mode,
        uint256 pointsEarned,
        bytes32 tripHash
    );
    
    event RewardRedeemed(
        address indexed user,
        string indexed rewardId,
        uint256 pointsCost,
        uint256 newBalance
    );
    
    event RewardAdded(string rewardId, string name, uint256 pointsCost);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        
        // Initialize emission factors (grams CO2 per km) - aligned with backend (UK DESNZ 2024, German UBA 2022)
        emissionFactors["car"] = 177;      // Petrol car, 1 occupant
        emissionFactors["car4"] = 44;      // Petrol car, 4 occupants
        emissionFactors["ev_car"] = 46;    // Electric car, 1 occupant
        emissionFactors["bus"] = 105;      // Average local bus
        emissionFactors["coach"] = 29;     // Long-distance bus
        emissionFactors["train"] = 35;     // Domestic rail
        emissionFactors["metro"] = 60;     // Metro/tram
        emissionFactors["bike"] = 0;       // Bicycle
        emissionFactors["walk"] = 0;       // Walking
        emissionFactors["ebike"] = 13;     // E-bike life-cycle
        emissionFactors["scooter"] = 25;   // E-scooter
        emissionFactors["motorcycle"] = 103; // Medium motorcycle
        
        // Initialize sample rewards
        _addReward("COFFEE_VOUCHER", "Free Coffee", 100);
        _addReward("BUS_TICKET", "Free Bus Ticket", 250);
        _addReward("TREE_PLANT", "Plant a Tree", 500);
        _addReward("BIKE_RENTAL", "1 Day Bike Rental", 750);
    }

    // Core Functions
    function recordTrip(
        uint256 _tripId,
        address _user,
        string memory _mode,
        uint256 _distance,
        uint256 _duration
    ) external returns (uint256 pointsEarned) {
        require(!tripIdUsed[_user][_tripId], "Trip already recorded");
        
        // Validate trip parameters to prevent cheating via direct contract calls
        require(_distance > 0 && _distance <= 500_000, "Invalid distance (max 500km)");
        require(_duration > 0 && _duration <= 86_400, "Invalid duration (max 24 hours)");
        
        // Basic speed check: prevent unrealistic speeds
        uint256 distanceKm = _distance / 1000;
        uint256 durationMin = _duration / 60;
        if (durationMin > 0) {
            uint256 avgSpeedKmPerMin = distanceKm / durationMin;
            require(avgSpeedKmPerMin <= 3, "Average speed too high (max ~180 km/h)"); // ~180 km/h max
        }
        
        bytes32 tripHash = keccak256(
            abi.encodePacked(_tripId, _user, _mode, _distance, _duration)
        );
        
        // Calculate base points and emissions bonus
        uint256 basePoints = (distanceKm * ALPHA) + (durationMin * BETA);
        
        // Calculate emissions saved (car baseline vs actual mode)
        uint256 emissionsSaved = (distanceKm * emissionFactors["car"]) - 
                                 (distanceKm * emissionFactors[_mode]);
        
        // Add emissions bonus: 1 point per 100g CO2 saved
        uint256 emissionsBonus = emissionsSaved / EMISSIONS_BONUS_FACTOR;
        pointsEarned = basePoints + emissionsBonus;
        
        // Create trip record
        Trip memory newTrip = Trip({
            tripId: _tripId,
            user: _user,
            mode: _mode,
            distance: _distance,
            duration: _duration,
            pointsEarned: pointsEarned,
            emissionsSaved: emissionsSaved,
            timestamp: block.timestamp,
            tripHash: tripHash
        });
        
        // Update state
        userTrips[_user].push(newTrip);
        tripIdUsed[_user][_tripId] = true;
        tripExists[tripHash] = true;
        pointsBalance[_user] += pointsEarned;
        totalTrips++;
        totalPointsIssued += pointsEarned;
        
        emit TripRecorded(_user, _tripId, _mode, pointsEarned, tripHash);
        
        return pointsEarned;
    }

    function getBalance(address _user) external view returns (uint256) {
        return pointsBalance[_user];
    }

    function getTripHistory(address _user) external view returns (Trip[] memory) {
        return userTrips[_user];
    }

    function verifyTrip(bytes32 _tripHash) external view returns (bool) {
        return tripExists[_tripHash];
    }

    function redeemReward(
        address _user,
        string memory _rewardId,
        uint256 _pointsCost
    ) external returns (bool) {
        Reward memory reward = rewardCatalog[_rewardId];
        
        require(reward.active, "Reward not available");
        require(reward.pointsCost == _pointsCost, "Invalid points cost");
        require(pointsBalance[_user] >= _pointsCost, "Insufficient points");
        
        // Deduct points
        pointsBalance[_user] -= _pointsCost;
        
        // Record redemption
        bytes32 txHash = keccak256(
            abi.encodePacked(_user, _rewardId, _pointsCost, block.timestamp)
        );
        
        Redemption memory newRedemption = Redemption({
            redemptionId: totalRedemptions,
            user: _user,
            rewardId: _rewardId,
            pointsCost: _pointsCost,
            timestamp: block.timestamp,
            txHash: txHash
        });
        
        userRedemptions[_user].push(newRedemption);
        totalRedemptions++;
        
        emit RewardRedeemed(_user, _rewardId, _pointsCost, pointsBalance[_user]);
        
        return true;
    }

    function getRedemptionHistory(address _user) 
        external 
        view 
        returns (Redemption[] memory) 
    {
        return userRedemptions[_user];
    }

    function calculateTier(address _user) external view returns (string memory) {
        uint256 balance = pointsBalance[_user];
        
        if (balance >= 5000) return "Diamond";
        if (balance >= 2000) return "Gold";
        if (balance >= 500) return "Silver";
        return "Bronze";
    }

    // Admin Functions
    function _addReward(
        string memory _rewardId,
        string memory _name,
        uint256 _pointsCost
    ) private {
        rewardCatalog[_rewardId] = Reward({
            rewardId: _rewardId,
            name: _name,
            pointsCost: _pointsCost,
            active: true
        });
        
        emit RewardAdded(_rewardId, _name, _pointsCost);
    }

    function addReward(
        string memory _rewardId,
        string memory _name,
        uint256 _pointsCost
    ) external onlyOwner {
        _addReward(_rewardId, _name, _pointsCost);
    }

    function updateRewardStatus(string memory _rewardId, bool _active) 
        external 
        onlyOwner 
    {
        rewardCatalog[_rewardId].active = _active;
    }

    function getReward(string memory _rewardId) 
        external 
        view 
        returns (Reward memory) 
    {
        return rewardCatalog[_rewardId];
    }

    // Stats functions
    function getUserStats(address _user) 
        external 
        view 
        returns (
            uint256 balance,
            uint256 tripCount,
            uint256 redemptionCount,
            string memory tier,
            uint256 totalEmissionsSaved
        ) 
    {
        balance = pointsBalance[_user];
        tripCount = userTrips[_user].length;
        redemptionCount = userRedemptions[_user].length;
        
        // Calculate tier
        if (balance >= 5000) tier = "Diamond";
        else if (balance >= 2000) tier = "Gold";
        else if (balance >= 500) tier = "Silver";
        else tier = "Bronze";
        
        // Calculate total emissions saved
        Trip[] memory trips = userTrips[_user];
        for (uint i = 0; i < trips.length; i++) {
            totalEmissionsSaved += trips[i].emissionsSaved;
        }
    }
}