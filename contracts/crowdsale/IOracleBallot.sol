contract OracleBallot
{

	uint PAGE_SIZE = 10;
	uint MAX_INFO = 512;
	uint MAX_TYPE = 5;

	struct Oracle
	{
		string info;
		uint8 oracle_type;
		bool status;
		address addr;
	}

	struct Vote
	{
		address voter;
		bool vote_y;
	}

	address public master;
	mapping(address => bool) public admins;

	Oracle[] public oracles;
	mapping(address => uint) public oracles_index;

	mapping(address => address[]) public proj_oracles;
	mapping(address => mapping(address => uint)) public proj_oracles_index;

	mapping(address => mapping(uint => Vote[])) public vote_data;

	function setAdmin(address admin_addr) public;
	function removeAdmin(address admin_addr) public;
	function setOracle(address addr, string memory info, uint8 oracle_type, bool status) public;
	event Log(address from, uint len);
	function linkOracle(address addr, address proj) public;
	function unlinkOracle(address addr, address proj) public;
	function getProjOracles(address proj, uint page) external view returns (address[] memory data, uint8[] memory types, bool[] memory statuses);
	function getOracles(uint page) external view returns (address[] memory data, uint8[] memory types, bool[] memory statuses);
	function getOracle(uint index) external view returns (string memory info, uint8 oracle_type, bool status);
	event Log(address from);
	function vote(address crowdsale_addr, uint milestone_index, bool vote_y) public;
	function get_vote_result(address crowdsale_addr, uint milestone_index) public view returns(uint vote_y, uint vote_n, uint vote_all, bool can_vote);

}