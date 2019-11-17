pragma solidity ^0.4.24;


//import "openzeppelin-solidity/contracts/ownership/Secondary.sol";
//import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
//import "openzeppelin-solidity/contracts/math/SafeMath.sol";
//import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
//import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
//import "./crowdsale/IW12Crowdsale.sol";
//import "./versioning/Versionable.sol";
//import "./token/IWToken.sol";


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


	constructor() public
	{
		master = msg.sender;
	}


	function setAdmin(address admin_addr) public
	{
//		if(msg.sender != owner)
		{
			require(msg.sender == master);
		}


		admins[admin_addr] = true;
	}


	function removeAdmin(address admin_addr) public
	{
//		if(msg.sender != owner)
		{
			require(msg.sender == master);
		}

		admins[admin_addr] = false;
	}


	function setOracle(address addr, string memory info, uint8 oracle_type, bool status) public
	{
		require(admins[msg.sender]);

		require(addr != address(0));

		bytes memory str_b = bytes(info);

		require(str_b.length <= MAX_INFO);

		require(oracle_type <= MAX_TYPE);

		if(oracles_index[addr] == 0)
		{
			Oracle memory oracle = Oracle(info, oracle_type, status, addr);

			oracles_index[addr] = oracles.push(oracle);
		}
		else
		{
			uint index = oracles_index[addr] - 1;

			oracles[index].info = info;
			oracles[index].oracle_type = oracle_type;
			oracles[index].status = status;
		}
	}

//	event Log(address from, uint len);


	function linkOracle(address addr, address proj) public
	{
		require(admins[msg.sender]);

		require(addr != address(0));

		uint index = oracles_index[addr];


		require(index != 0);

		require(proj != address(0));

		uint p_index = proj_oracles_index[proj][addr];

//		emit Log(proj, p_index);

		if(p_index == 0)
		{
			proj_oracles_index[proj][addr] = proj_oracles[proj].push(addr);

//			emit Log(proj, proj_oracles_index[proj][addr]);
		}
	}

	function getProjOracles(address proj, uint page) external view returns (address[] memory data, uint8[] memory types, bool[] memory statuses)
	{
		data = new address[](PAGE_SIZE);
		types = new uint8[](PAGE_SIZE);
		statuses = new bool[](PAGE_SIZE);

		uint start = page * PAGE_SIZE;

		uint index;

		for(uint i = 0; i < PAGE_SIZE; i++)
		{
			if(start + i < proj_oracles[proj].length)
			{
				data[i] = proj_oracles[proj][start + i];
				index = oracles_index[data[i]];
				if(index != 0)
				{
					types[i] = oracles[index - 1].oracle_type;
					statuses[i] = oracles[index - 1].status;
				}
			}
		}
	}


	function getOracles(uint page) external view returns (address[] memory data, uint8[] memory types, bool[] memory statuses)
	{
		data = new address[](PAGE_SIZE);
		types = new uint8[](PAGE_SIZE);
		statuses = new bool[](PAGE_SIZE);

		uint256 start = page * PAGE_SIZE;

		for(uint256 i = 0; i < PAGE_SIZE; i++)
		{
			if(start + i < oracles.length)
			{
				data[i] = oracles[start + i].addr;
				types[i] = oracles[start + i].oracle_type;
				statuses[i] = oracles[start + i].status;
			}
		}
	}



	function getOracle(uint index) external view returns (string memory info, uint8 oracle_type, bool status)
	{
		require(index < oracles.length);
		require(index > 0);

		info = oracles[index].info;
		oracle_type = oracles[index].oracle_type;
		status = oracles[index].status;
	}

//	event Log(address from);

	function vote(address crowdsale_addr, uint milestone_index, bool vote_y) public
	{
		bytes memory name;

		uint32 end_date;
		uint percent;
		uint32 vote_end;
		uint32 withdrawal;

		address sale = crowdsale_addr;

		address token = 0;//address(sale.getWToken());

		require(proj_oracles_index[token][msg.sender] != 0);

		uint index = oracles_index[msg.sender];

		require(oracles[index].status);

		bool vote_flag = false;

		for(uint i = 0; i < vote_data[token][milestone_index].length; i++)
		{
			if(vote_data[token][milestone_index][i].voter == msg.sender)
			{
				vote_flag = true;
			}
		}

		require(!vote_flag);

//		(end_date, percent, vote_end, withdrawal, name, ) = sale.getMilestone(milestone_index);

//		require(now > end_date);
//		require(now <= vote_end);

		vote_data[token][milestone_index].push(Vote(msg.sender, vote_y));

//		emit Log(token);
	}




	function get_vote_result(address crowdsale_addr, uint milestone_index) public view returns(uint vote_y, uint vote_n, uint vote_all, bool can_vote)
	{
		bytes memory name;
		uint32 end_date;
		uint32 vote_end;
		uint32 withdrawal;


		address sale = crowdsale_addr;

		address token = 0;//address(sale.getWToken());

		uint i;

		can_vote = true;

		if(msg.sender != address(0))
		{
			if(proj_oracles_index[token][msg.sender] == 0)
				can_vote = false;

			uint index = oracles_index[msg.sender];

			if(!oracles[index].status)
				can_vote = false;



			for(i = 0; i < vote_data[token][milestone_index].length; i++)
			{
				if(vote_data[token][milestone_index][i].voter == msg.sender)
				{
					can_vote = false;
				}
			}

//			(end_date, i, vote_end, withdrawal, name, name) = sale.getMilestone(milestone_index);

			if(now < end_date || now > vote_end)
				can_vote = false;
		}
		else
		{
			can_vote = false;
		}


		for(i = 0; i < vote_data[token][milestone_index].length; i++)
		{
			if(vote_data[token][milestone_index][i].vote_y)
			{
				vote_y++;
			}
			else
			{
				vote_n++;
			}
		}

		vote_all = 0;

		for(i = 0; i < proj_oracles[token].length; i++)
		{
			index = oracles_index[proj_oracles[token][i]];

			if(index != 0)
			{
				if(oracles[index].status)
				{
					vote_all++;
				}
			}

		}
	}


	function set_master(address new_master) public
	{
		require(new_master != address(0));
//		emit MastershipTransferred(master, new_master);
		master = new_master;
	}
}