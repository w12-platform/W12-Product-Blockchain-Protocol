pragma solidity ^0.4.24;

import "./IRates.sol";
import "../access/roles/IAdminRole.sol";
import "../access/roles/AdminRole.sol";
import "../access/roles/ISuggestorRole.sol";
import "../access/roles/SuggestorRole.sol";


contract RatesGuard is IAdminRole, ISuggestorRole, AdminRole, SuggestorRole {
    enum FailCase { NO_BEST_SUGGESTION, TOO_BIG_DIFF_FROM_PREVIOUSLY_RATE, SYMBOLS_MISMATCH, CONFIRM_SUGGESTION_FAIL }

    struct Suggestion {
        bytes32[] symbols;
        mapping(bytes32 => uint) rate;
        mapping(bytes32 => bool) has;
        uint timestamp;
    }

    mapping(address => Suggestion) private suggestions;
    address[] private suggestors;

    IRates public rates;
    uint public validationTriggerCondition;
    uint public minSuggestionMatch;
    uint public diffPrevTolerant;
    mapping(bytes32 => uint) public diffPrevTolerantForSymbol;
    mapping(bytes32 => bool) public hasDiffPrevTolerantForSymbol;
    uint public lockOnFailTimeout;
    uint public diffTolerant;
    mapping(bytes32 => uint) public diffTolerantForSymbol;
    mapping(bytes32 => bool) public hasDiffTolerantForSymbol;
    uint public expireTimeout;
    uint public lockUntil;

    event Fail(FailCase indexed failCase);
    event SuggestionConfirmed(address indexed suggestor);
    event SuggestionAccepted(address indexed suggestor);
    event SettingUpdated(
        address indexed updater,
        address rates,
        uint validationTriggerCondition,
        uint minSuggestionMatch,
        uint diffPrevTolerant,
        uint lockOnFailTimeout,
        uint diffTolerant,
        uint expireTimeout
    );
    event DiffTolerantForSymbolsUpdated(address indexed updater, bytes32 symbol, uint value);
    event DiffTolerantForSymbolsRemoved(address indexed remover, bytes32 symbol);
    event DiffPrevTolerantForSymbolsUpdated(address indexed updater, bytes32 symbol, uint value);
    event DiffPrevTolerantForSymbolsRemoved(address indexed remover, bytes32 symbol);

    constructor(
        IRates _rates,
        uint _validationTriggerCondition,
        uint _minSuggestionMatch,
        uint _diffPrevTolerant,
        uint _lockOnFailTimeout,
        uint _diffTolerant,
        uint _expireTimeout,
        address[] _suggestors
    ) public {
        _setRates(_rates);
        _setValidationTriggerCondition(_validationTriggerCondition);
        _setMinSuggestionMatch(_minSuggestionMatch);
        _setDiffPrevTolerant(_diffPrevTolerant);
        _setLockOnFailTimeout(_lockOnFailTimeout);
        _setDiffTolerant(_diffTolerant);
        _setExpireTimeout(_expireTimeout);
        _emitSettingsUpdateEvent();
        renounceSuggestor();
        bulkAddSuggestor(_suggestors);
    }

    function _setRates(IRates _rates) internal {
        require(address(_rates) != address(0));
        rates = _rates;
    }

    function _setValidationTriggerCondition(uint value) internal {
        require(value > 1);
        validationTriggerCondition = value;
    }

    function _setMinSuggestionMatch(uint value) internal {
        require(value > 0);
        minSuggestionMatch = value;
    }

    function _setDiffPrevTolerant(uint value) internal {
        diffPrevTolerant = value;
    }

    function _setDiffTolerant(uint value) internal {
        diffTolerant = value;
    }

    function _setLockOnFailTimeout(uint value) internal {
        lockOnFailTimeout = value;
    }

    function _setExpireTimeout(uint value) internal {
        expireTimeout = value;
    }

    function setRates(IRates _rates) public {
        _setRates(_rates);
        _emitSettingsUpdateEvent();
    }

    function setValidationTriggerCondition(uint value) public {
        _setValidationTriggerCondition(value);
        _emitSettingsUpdateEvent();
    }

    function setMinSuggestionMatch(uint value) public {
        _setMinSuggestionMatch(value);
        _emitSettingsUpdateEvent();
    }

    function setDiffPrevTolerant(uint value) public {
        _setDiffPrevTolerant(value);
        _emitSettingsUpdateEvent();
    }

    function setDiffPrevTolerantForSymbol(bytes32 symbol, uint value) public {
        diffPrevTolerantForSymbol[symbol] = value;
        hasDiffPrevTolerantForSymbol[symbol] = true;
        emit DiffPrevTolerantForSymbolsUpdated(msg.sender, symbol, value);
    }

    function unsetDiffPrevTolerantForSymbol(bytes32 symbol) public {
        diffPrevTolerantForSymbol[symbol] = 0;
        hasDiffPrevTolerantForSymbol[symbol] = false;
        emit DiffPrevTolerantForSymbolsRemoved(msg.sender, symbol);
    }

    function setLockOnFailTimeout(uint value) public {
        _setLockOnFailTimeout(value);
        _emitSettingsUpdateEvent();
    }

    function setDiffTolerant(uint value) public {
        _setDiffTolerant(value);
        _emitSettingsUpdateEvent();
    }

    function setDiffTolerantForSymbol(bytes32 symbol, uint value) public {
        diffTolerantForSymbol[symbol] = value;
        hasDiffTolerantForSymbol[symbol] = true;
        emit DiffTolerantForSymbolsUpdated(msg.sender, symbol, value);
    }

    function unsetDiffTolerantForSymbol(bytes32 symbol) public {
        diffTolerantForSymbol[symbol] = 0;
        hasDiffTolerantForSymbol[symbol] = false;
        emit DiffTolerantForSymbolsRemoved(msg.sender, symbol);
    }

    function setExpireTimeout(uint value) public {
        _setExpireTimeout(value);
        _emitSettingsUpdateEvent();
    }

    function _emitSettingsUpdateEvent() internal {
        emit SettingUpdated(
            msg.sender,
            address(rates),
            validationTriggerCondition,
            minSuggestionMatch,
            diffPrevTolerant,
            lockOnFailTimeout,
            diffTolerant,
            expireTimeout
        );
    }

    function addAdmin(address account) public onlyAdmin {
        _addAdmin(account);
    }

    function removeAdmin(address account) public onlyAdmin {
        _removeAdmin(account);
    }

    function addSuggestor(address account) public onlyAdmin {
        _addSuggestor(account);
    }

    function bulkAddSuggestor(address[] _suggestors) public onlyAdmin {
        for(uint i = 0; i < _suggestors.length; i++) {
            addSuggestor(_suggestors[i]);
        }
    }

    function removeSuggestor(address account) public onlyAdmin {
        _removeSuggestor(account);
    }

    function suggest(bytes32[] symbols, uint[] rates) public onlySuggestor {
        require(!isLocked());

        _addSuggestion(msg.sender, symbols, rates);
        _runPostProcessing();
    }

    function _addSuggestion(address suggestor, bytes32[] symbols, uint[] rates) internal {
        require(symbols.length != 0);
        require(symbols.length == rates.length);

        uint i;

        for(i = 0; i < suggestion[suggestor].symbols.length; i++) {
            suggestion[suggestor].has[suggestion[suggestor].symbols[i]] = false;
        }

        suggestion[suggestor].symbols = symbols;
        suggestion[suggestor].timestamp = now;

        for (i = 0; i < symbols.length; i++) {
            suggestion[suggestor].has[symbols[i]] = true;
            suggestion[suggestor].rate[symbols[i]] = rates[i];
        }

        emit SuggestionAccepted(suggestor);

        for(i = 0; i < suggestors.length; i++) {
            if (suggestors[i] == suggestor) {
                // push to the and of the list and save add/update order
                if (i != suggestors.length + 1) {
                    address tmp = suggestors[i];
                    for (uint ii = i; ii < suggestors.length - 1; ii++) {
                        suggestors[ii] = suggestors[ii + 1];
                    }
                    suggestors[suggestors.length - 1] = tmp;
                }
                return;
            }
        }

        suggestors.push(suggestor);
    }

    function _clearSuggestions() internal {
        suggestors.length = 0;
    }

    function _runPostProcessing() internal {
        _removeExpired();

        if (suggestors.length != validationTriggerCondition) {
            return;
        }

        (Suggestion storage _suggestion, address suggestor, bool found) = _findBestSuggestion();

        if (!found) {
            _lock();
            _clearSuggestions();
            emit Fail(FailCase.NO_BEST_SUGGESTION);
            return;
        }

        if (_isMismatchSymbols(_suggestion)) {
            _lock();
            _clearSuggestions();
            emit Fail(FailCase.SYMBOLS_MISMATCH);
            return;
        }

        if (_isTooBigFromPrev(_suggestion)) {
            _lock();
            _clearSuggestions();
            emit Fail(FailCase.TOO_BIG_DIFF_FROM_PREVIOUSLY_RATE);
            return;
        }

        if (!_confirmSuggestion(_suggestion)) {
            _lock();
            _clearSuggestions();
            emit Fail(FailCase.CONFIRM_SUGGESTION_FAIL);
            return;
        }

        _clearSuggestions();

        emit SuggestionConfirmed(suggestor);
    }

    function _lock() internal {
        lockUntil = now + lockOnFailTimeout;
    }

    function isLocked() public view returns(bool) {
        return now < lockUntil;
    }

    function _confirmSuggestion(Suggestion storage _suggestion) internal returns(bool) {
        for (uint i = 0; i < _suggestion.symbols.length; i++) {
            if(!address(rates).call(
                bytes4(keccak256('set(bytes32,uint256)')),
                _suggestion.symbols[i],
                _suggestion.rate[_suggestion.symbols[i]])) {
                return false;
            }
        }
        return true;
    }

    function _isTooBigFromPrev(Suggestion storage _suggestion) internal view returns(bool) {
        for (uint i = 0; i < _suggestion.symbols.length; i++) {
            uint prev = rates.get(_suggestion.symbols[i]);
            // skip if rate was not assigned yet
            if (prev == 0) continue;
            uint diff = prev >= _suggestion.rate[_suggestion.symbols[i]]
                ? prev - _suggestion.rate[_suggestion.symbols[i]]
                : _suggestion.rate[_suggestion.symbols[i]] - prev;
            if (diff > _getDiffPrevTolerant(_suggestion.symbols[i])) {
                return true;
            }
        }
        return false;
    }

    function _isMismatchSymbols(Suggestion storage _suggestion)  internal view returns(bool) {
        for(uint i = 0; i < _suggestion.symbols.length; i++) {
            if (!rates.hasSymbol(_suggestion.symbols[i])) {
                return true;
            }
        }
        return false;
    }

    function _removeExpired() internal {
        if (expireTimeout != 0) {
            uint lncut = 0;
            for(uint i = 0; i < suggestors.length; i++) {
                uint diff = now - suggestion[suggestors[i]].timestamp + 1;
                if (expireTimeout >= diff) {
                    if (i != suggestors.length - 1) {
                        suggestors[i] = suggestors[suggestors.length - 1];
                    }
                    lncut++;
                }
            }
            suggestors.length = suggestors.length - lncut;
        }
    }

    // event TableDebug(uint[] table);

    function _findBestSuggestion() internal view returns(Suggestion storage result, address suggestor, bool found) {
        uint[] memory table = new uint[](suggestors.length);
        uint i;

        for(i = 0; i < suggestors.length - 1; i++) {
            Suggestion storage current = suggestion[suggestors[i]];
            for (uint ii = i + 1; ii < suggestors.length; ii++) {
                Suggestion storage next = suggestion[suggestors[ii]];
                if (_isMatch(current, next)) {
                    table[i]++;
                    table[ii]++;
                }
            }
        }

        uint last;

        // emit TableDebug(table);

        for(i = 0; i < table.length; i++) {
            if (table[i] >= minSuggestionMatch) {
                if (found) {
                    if (table[i] > table[last]) {
                        last = i;
                    } else if (table[i] == table[last]) {
                        // take most recent by timestamp or by add/update order
                        if (suggestion[suggestors[i]].timestamp >= suggestion[suggestors[last]].timestamp) {
                            last = i;
                        }
                    }
                    continue;
                }
                found = true;
                last = i;
            }
        }

        if (found) {
            suggestor = suggestors[last];
            result = suggestion[suggestor];
        }
    }

    function _isMatch(Suggestion storage a, Suggestion storage b) internal view returns(bool) {
        if (a.symbols.length == b.symbols.length) {
            for (uint i = 0; i < a.symbols.length; i++) {
                if (b.has[a.symbols[i]]) {
                    uint diff = a.rate[a.symbols[i]] >= b.rate[a.symbols[i]]
                        ? a.rate[a.symbols[i]] - b.rate[a.symbols[i]]
                        : b.rate[a.symbols[i]] - a.rate[a.symbols[i]];
                    if (diff <= _getDiffTolerant(a.symbols[i])) {
                        continue;
                    }
                }
                return false;
            }
            return true;
        }
        return false;
    }

    function _getDiffTolerant(bytes32 symbol) internal view returns(uint) {
        if (hasDiffTolerantForSymbol[symbol]) {
            return diffTolerantForSymbol[symbol];
        } else {
            return diffTolerant;
        }
    }

    function _getDiffPrevTolerant(bytes32 symbol) internal view returns (uint) {
        if (hasDiffPrevTolerantForSymbol[symbol]) {
            return diffPrevTolerantForSymbol[symbol];
        } else {
            return diffPrevTolerant;
        }
    }
}
