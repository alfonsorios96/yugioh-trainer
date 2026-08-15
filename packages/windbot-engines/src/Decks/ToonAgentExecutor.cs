// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    /// <summary>
    /// Thin proxy: serialize the current WindBot prompt, wait for the
    /// teach server, execute the chosen actionId. Does not decide.
    /// </summary>
    [Deck("Toon2026Agent", "AI_Toon2026")]
    public class ToonAgentExecutor : MetaExecutor
    {
        private const string DefaultUrl = "http://127.0.0.1:8765/v1/decide";
        private const int HintRelease = 500;
        private const int HintDiscard = 501;
        private const int HintToGrave = 504;
        private const int HintToHand = 506;
        private const int HintSummon = 509;
        private const int HintSpSummon = 510;
        private const int HintTarget = 526;

        private string _chosenKind;
        private int _chosenCardId;
        private long _chosenDesc;
        private int _chosenOptionIndex;
        private List<int> _chosenCardIds;
        private string _duelId;
        private int _requestSeq;
        private int _summonCount;
        private bool _normalSummonUsed;
        private bool _chainPrompt;
        private IList<ClientCard> _chainCards;
        private IList<ClientCard> _selectCards;
        private IList<int> _announceIds;
        private IList<long> _optionValues;
        private int _selectMin;
        private int _selectMax;
        private bool _selectCancelable;
        private long _selectHint;

        public ToonAgentExecutor(GameAI ai, Duel duel)
            : base(ai, duel)
        {
            _duelId = Guid.NewGuid().ToString("N").Substring(0, 12);
            _chosenKind = "";
            _chosenCardId = 0;
            _chosenDesc = 0;
            _chosenOptionIndex = -1;
            _chosenCardIds = new List<int>();
            Bind(ExecutorType.Activate, new Func<bool>(this.DecideActivate));
            Bind(ExecutorType.Summon, new Func<bool>(this.DecideSummon));
            Bind(ExecutorType.SpSummon, new Func<bool>(this.DecideSpSummon));
            Bind(ExecutorType.SpellSet, new Func<bool>(this.DecideSpellSet));
            Bind(ExecutorType.MonsterSet, new Func<bool>(this.DecideMonsterSet));
            Bind(ExecutorType.Repos, new Func<bool>(this.DecideRepos));
            Bind(ExecutorType.GoToEndPhase, new Func<bool>(this.DecideEnd));
        }

        public override void OnNewTurn()
        {
            ClearChoice();
            _summonCount = 0;
            _normalSummonUsed = false;
            _chainPrompt = false;
            _chainCards = null;
        }

        public override void OnNewPhase()
        {
            if (!_chainPrompt)
                ClearChoice();
        }

        private void ClearChoice()
        {
            _chosenKind = "";
            _chosenCardId = 0;
            _chosenDesc = 0;
            _chosenOptionIndex = -1;
            _chosenCardIds = new List<int>();
        }

        private bool DecideActivate()
        {
            if (_chainPrompt)
                return MatchChain();
            return MatchKind("activate");
        }

        private bool DecideSummon()
        {
            if (!MatchKind("summon"))
                return false;
            _normalSummonUsed = true;
            _summonCount++;
            return true;
        }

        private bool DecideSpSummon()
        {
            if (!MatchKind("spsummon"))
                return false;
            _summonCount++;
            return true;
        }

        private bool DecideSpellSet()
        {
            return MatchKind("set");
        }

        private bool DecideMonsterSet()
        {
            return MatchKind("set");
        }

        private bool DecideRepos()
        {
            return MatchKind("repos");
        }

        private bool DecideEnd()
        {
            EnsureChoice("idle", null);
            if (_chosenKind != "to_ep")
                return false;
            ClearChoice();
            return true;
        }

        private bool MatchKind(string kind)
        {
            EnsureChoice("idle", null);
            if (_chosenKind == "to_ep")
                return false;
            if (_chosenKind != kind)
                return false;
            if (CurrentCard == null)
                return false;
            if (CurrentCard.Id != _chosenCardId)
                return false;
            if (kind == "activate" && _chosenDesc != 0 && ActivateDescription != _chosenDesc)
                return false;
            ClearChoice();
            return true;
        }

        private bool MatchChain()
        {
            EnsureChoice("chain", null);
            if (_chosenKind == "chain" && _chosenCardId == 0)
                return false;
            if (_chosenKind != "chain" && _chosenKind != "activate")
                return false;
            if (CurrentCard == null || CurrentCard.Id != _chosenCardId)
                return false;
            if (_chosenDesc != 0 && ActivateDescription != 0 && ActivateDescription != _chosenDesc)
                return false;
            ClearChoice();
            _chainPrompt = false;
            _chainCards = null;
            return true;
        }

        private void EnsureChoice(string promptKind, string selectRole)
        {
            if (promptKind == "idle" && _chainPrompt)
            {
                ClearChoice();
                _chainPrompt = false;
                _chainCards = null;
            }
            if (_chosenKind != "")
                return;
            string json = BuildRequest(promptKind, selectRole);
            string response = PostDecide(json);
            ParseChoice(response);
        }

        private string BuildRequest(string promptKind, string selectRole)
        {
            _requestSeq++;
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            sb.Append("\"requestId\":\"").Append(_duelId).Append("-").Append(_requestSeq).Append("\",");
            sb.Append("\"duelId\":\"").Append(_duelId).Append("\",");
            sb.Append("\"turn\":").Append(Match.Turn).Append(",");
            sb.Append("\"phase\":\"").Append(Match.Phase.ToString()).Append("\",");
            sb.Append("\"going\":\"").Append(Match.IsFirst ? "first" : "second").Append("\",");
            sb.Append("\"promptKind\":\"").Append(promptKind).Append("\",");
            sb.Append("\"deckId\":\"toon-2026\",");
            sb.Append("\"self\":").Append(FieldJson(FieldBot)).Append(",");
            sb.Append("\"opp\":").Append(FieldJson(FieldEnemy)).Append(",");
            sb.Append("\"threats\":").Append(ThreatsJson()).Append(",");
            sb.Append("\"constraints\":{");
            sb.Append("\"normalSummonUsed\":").Append(_normalSummonUsed ? "true" : "false").Append(",");
            sb.Append("\"summonCount\":").Append(_summonCount);
            if (selectRole != null)
                sb.Append(",\"selectRole\":\"").Append(selectRole).Append("\"");
            if (promptKind == "select")
            {
                sb.Append(",\"selectMin\":").Append(_selectMin);
                sb.Append(",\"selectMax\":").Append(_selectMax);
                sb.Append(",\"selectCancelable\":").Append(_selectCancelable ? "true" : "false");
                sb.Append(",\"selectHint\":").Append(_selectHint);
            }
            if (promptKind == "chain")
                sb.Append(",\"chainPlayer\":").Append(ReadIntProp(Match, "LastChainPlayer", -1));
            sb.Append("},");
            sb.Append("\"legalActions\":[");
            sb.Append(LegalActionsJson(promptKind));
            sb.Append("]");
            sb.Append("}");
            return sb.ToString();
        }

        private string LegalActionsJson(string promptKind)
        {
            if (promptKind == "select")
                return SelectActionsJson();
            if (promptKind == "announce")
                return AnnounceActionsJson();
            if (promptKind == "chain")
                return ChainActionsJson();
            if (promptKind == "option")
                return OptionActionsJson();
            return IdleActionsJson();
        }

        private string IdleActionsJson()
        {
            StringBuilder sb = new StringBuilder();
            bool first = true;
            MainPhase main = Match.MainPhase;
            first = AppendCards(sb, first, "summon", main.SummonableCards);
            first = AppendCards(sb, first, "spsummon", main.SpecialSummonableCards);
            first = AppendActivates(sb, first, main);
            first = AppendCards(sb, first, "set", main.SpellSetableCards);
            first = AppendCards(sb, first, "set", main.MonsterSetableCards);
            if (!first)
                sb.Append(",");
            sb.Append("{\"id\":\"to-ep\",\"kind\":\"to_ep\"}");
            return sb.ToString();
        }

        private bool AppendActivates(StringBuilder sb, bool first, MainPhase main)
        {
            IList<ClientCard> cards = main.ActivableCards;
            if (cards == null)
                return first;
            IList<long> descs = main.ActivableDescs;
            for (int i = 0; i < cards.Count; i++)
            {
                ClientCard c = cards[i];
                if (c == null || c.Id <= 0)
                    continue;
                long desc = 0;
                if (descs != null && i < descs.Count)
                    desc = descs[i];
                if (!first)
                    sb.Append(",");
                sb.Append("{\"id\":\"activate-").Append(c.Id).Append("-").Append(desc);
                sb.Append("\",\"kind\":\"activate\",\"cardId\":").Append(c.Id);
                sb.Append(",\"desc\":").Append(desc).Append("}");
                first = false;
            }
            return first;
        }

        private string SelectActionsJson()
        {
            StringBuilder sb = new StringBuilder();
            bool first = true;
            if (_selectCards != null)
            {
                for (int i = 0; i < _selectCards.Count; i++)
                {
                    ClientCard c = _selectCards[i];
                    if (c == null || c.Id <= 0)
                        continue;
                    if (!first)
                        sb.Append(",");
                    sb.Append("{\"id\":\"select-").Append(c.Id).Append("-").Append(i);
                    sb.Append("\",\"kind\":\"select\",\"cardId\":").Append(c.Id).Append("}");
                    first = false;
                }
            }
            if (_selectCancelable)
            {
                if (!first)
                    sb.Append(",");
                sb.Append("{\"id\":\"select-skip\",\"kind\":\"select\"}");
            }
            return sb.ToString();
        }

        private string AnnounceActionsJson()
        {
            StringBuilder sb = new StringBuilder();
            bool first = true;
            if (_announceIds != null)
            {
                for (int i = 0; i < _announceIds.Count; i++)
                {
                    int id = _announceIds[i];
                    if (id <= 0)
                        continue;
                    if (!first)
                        sb.Append(",");
                    sb.Append("{\"id\":\"announce-").Append(id).Append("-").Append(i);
                    sb.Append("\",\"kind\":\"announce\",\"cardId\":").Append(id).Append("}");
                    first = false;
                }
            }
            return sb.ToString();
        }

        private string ChainActionsJson()
        {
            StringBuilder sb = new StringBuilder();
            bool first = true;
            if (_chainCards != null)
            {
                for (int i = 0; i < _chainCards.Count; i++)
                {
                    ClientCard c = _chainCards[i];
                    if (c == null || c.Id <= 0)
                        continue;
                    if (!first)
                        sb.Append(",");
                    sb.Append("{\"id\":\"chain-").Append(c.Id).Append("-").Append(i);
                    sb.Append("\",\"kind\":\"chain\",\"cardId\":").Append(c.Id).Append("}");
                    first = false;
                }
            }
            if (!first)
                sb.Append(",");
            sb.Append("{\"id\":\"chain-pass\",\"kind\":\"chain\"}");
            return sb.ToString();
        }

        private string OptionActionsJson()
        {
            StringBuilder sb = new StringBuilder();
            bool first = true;
            if (_optionValues != null)
            {
                for (int i = 0; i < _optionValues.Count; i++)
                {
                    if (!first)
                        sb.Append(",");
                    sb.Append("{\"id\":\"option-").Append(i);
                    sb.Append("\",\"kind\":\"option\",\"optionIndex\":").Append(i);
                    sb.Append(",\"desc\":").Append(_optionValues[i]).Append("}");
                    first = false;
                }
            }
            return sb.ToString();
        }

        private bool AppendCards(StringBuilder sb, bool first, string kind, IList<ClientCard> cards)
        {
            if (cards == null)
                return first;
            for (int i = 0; i < cards.Count; i++)
            {
                ClientCard c = cards[i];
                if (c == null || c.Id <= 0)
                    continue;
                if (!first)
                    sb.Append(",");
                sb.Append("{\"id\":\"").Append(kind).Append("-").Append(c.Id).Append("-").Append(i);
                sb.Append("\",\"kind\":\"").Append(kind);
                sb.Append("\",\"cardId\":").Append(c.Id).Append("}");
                first = false;
            }
            return first;
        }

        private static int ReadIntProp(object obj, string name, int fallback)
        {
            if (obj == null)
                return fallback;
            PropertyInfo prop = obj.GetType().GetProperty(name);
            if (prop == null)
                return fallback;
            object value = prop.GetValue(obj, null);
            if (value == null)
                return fallback;
            return Convert.ToInt32(value);
        }

        private string ThreatsJson()
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("[");
            bool first = true;
            first = AppendThreat(sb, first, "fuwalos", ToonCardId.Fuwalos);
            first = AppendThreat(sb, first, "maxx-c", ToonCardId.MaxxC);
            AppendThreat(sb, first, "ash", ToonCardId.AshBlossom);
            sb.Append("]");
            return sb.ToString();
        }

        private bool AppendThreat(StringBuilder sb, bool first, string name, int cardId)
        {
            if (!OppHasCard(cardId))
                return first;
            if (!first)
                sb.Append(",");
            sb.Append("\"").Append(name).Append("\"");
            return false;
        }

        private bool OppHasCard(int cardId)
        {
            return ContainsId(FieldEnemy.Hand, cardId)
                || ContainsId(FieldEnemy.Graveyard, cardId)
                || ContainsId(FieldEnemy.Banished, cardId)
                || ContainsId(FieldEnemy.MonsterZone, cardId);
        }

        private bool ChainHasCard(int cardId)
        {
            return ContainsId(_chainCards, cardId);
        }

        private static bool ContainsId(IList<ClientCard> cards, int cardId)
        {
            if (cards == null)
                return false;
            for (int i = 0; i < cards.Count; i++)
            {
                if (cards[i] != null && cards[i].Id == cardId)
                    return true;
            }
            return false;
        }

        private string FieldJson(ClientField field)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            sb.Append("\"lp\":").Append(field.LifePoints).Append(",");
            sb.Append("\"hand\":").Append(IdList(field.Hand)).Append(",");
            sb.Append("\"monsters\":").Append(ZoneIds(field.MonsterZone)).Append(",");
            sb.Append("\"spells\":").Append(ZoneIds(field.SpellZone)).Append(",");
            sb.Append("\"grave\":").Append(IdList(field.Graveyard)).Append(",");
            sb.Append("\"banished\":").Append(IdList(field.Banished)).Append(",");
            sb.Append("\"extra\":").Append(IdList(field.ExtraDeck)).Append(",");
            sb.Append("\"monsterZones\":").Append(ZoneSlots(field.MonsterZone, 7)).Append(",");
            sb.Append("\"spellZones\":").Append(ZoneSlots(field.SpellZone, 6)).Append(",");
            sb.Append("\"monsterStances\":").Append(ZoneStances(field.MonsterZone, 7)).Append(",");
            sb.Append("\"spellStances\":").Append(ZoneStances(field.SpellZone, 6));
            sb.Append("}");
            return sb.ToString();
        }

        private string IdList(IList<ClientCard> cards)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("[");
            bool first = true;
            if (cards != null)
            {
                for (int i = 0; i < cards.Count; i++)
                {
                    ClientCard c = cards[i];
                    if (c == null || c.Id <= 0)
                        continue;
                    if (!first)
                        sb.Append(",");
                    sb.Append(c.Id);
                    first = false;
                }
            }
            sb.Append("]");
            return sb.ToString();
        }

        private string ZoneIds(IList<ClientCard> zones)
        {
            return IdList(zones);
        }

        private string ZoneSlots(IList<ClientCard> zones, int len)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("[");
            for (int i = 0; i < len; i++)
            {
                if (i > 0)
                    sb.Append(",");
                int id = 0;
                if (zones != null && i < zones.Count && zones[i] != null)
                    id = zones[i].Id;
                sb.Append(id);
            }
            sb.Append("]");
            return sb.ToString();
        }

        private string ZoneStances(IList<ClientCard> zones, int len)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("[");
            for (int i = 0; i < len; i++)
            {
                if (i > 0)
                    sb.Append(",");
                string stance = "";
                if (zones != null && i < zones.Count && zones[i] != null)
                    stance = StanceFromPos(zones[i].Position);
                sb.Append("\"").Append(stance).Append("\"");
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static string StanceFromPos(int pos)
        {
            if (pos == 0)
                return "";
            if ((pos & 0x0a) != 0 && (pos & 0x05) == 0)
                return "set";
            if ((pos & 0x04) != 0 && (pos & 0x01) == 0)
                return "def";
            return "atk";
        }

        private string PostDecide(string body)
        {
            string url = Environment.GetEnvironmentVariable("YGO_AGENT_URL");
            if (string.IsNullOrEmpty(url))
                url = DefaultUrl;
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.Timeout = 600000;
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            req.ContentLength = bytes.Length;
            using (Stream stream = req.GetRequestStream())
            {
                stream.Write(bytes, 0, bytes.Length);
            }
            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
            using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        private void ParseChoice(string json)
        {
            _chosenCardIds = ExtractJsonNumberArray(json, "cardIds");
            string kind = ExtractJsonString(json, "kind");
            string actionId = ExtractJsonString(json, "actionId");
            if (actionId == "to-ep" || actionId == "to_ep" || kind == "to_ep")
            {
                _chosenKind = "to_ep";
                _chosenCardId = 0;
                return;
            }
            if (actionId == "chain-pass")
            {
                _chosenKind = "chain";
                _chosenCardId = 0;
                return;
            }
            if (actionId == "select-skip")
            {
                _chosenKind = "select";
                _chosenCardId = 0;
                _chosenCardIds = new List<int>();
                return;
            }
            if (kind != "")
                _chosenKind = kind;
            else if (actionId != "")
            {
                int dash = actionId.IndexOf('-');
                if (dash > 0)
                    _chosenKind = actionId.Substring(0, dash);
                else
                    _chosenKind = actionId;
            }
            string idField = ExtractJsonNumber(json, "cardId");
            if (idField != "")
                _chosenCardId = int.Parse(idField);
            else if (_chosenCardIds.Count > 0)
                _chosenCardId = _chosenCardIds[0];
            else
            {
                string[] parts = actionId.Split('-');
                if (parts.Length >= 2)
                {
                    int parsed;
                    if (int.TryParse(parts[1], out parsed))
                        _chosenCardId = parsed;
                }
            }
            string descField = ExtractJsonNumber(json, "desc");
            if (descField != "")
                _chosenDesc = long.Parse(descField);
            string optField = ExtractJsonNumber(json, "optionIndex");
            if (optField != "")
                _chosenOptionIndex = int.Parse(optField);
            else if (_chosenKind == "option" && actionId.StartsWith("option-"))
            {
                int parsed;
                if (int.TryParse(actionId.Substring(7), out parsed))
                    _chosenOptionIndex = parsed;
            }
            if (_chosenCardIds.Count == 0 && _chosenCardId > 0)
                _chosenCardIds.Add(_chosenCardId);
        }

        public override IList<ClientCard> OnSelectCard(IList<ClientCard> cards, int min, int max, long hint, bool cancelable)
        {
            ClearChoice();
            _selectCards = cards;
            _selectMin = min;
            _selectMax = max;
            _selectCancelable = cancelable;
            _selectHint = hint;
            EnsureChoice("select", InferSelectRole(hint, min));
            List<ClientCard> picked = new List<ClientCard>();
            if (_chosenCardId == 0 && _chosenCardIds.Count == 0)
            {
                _selectCards = null;
                if (cancelable)
                    return picked;
            }
            if (cards != null)
            {
                for (int n = 0; n < _chosenCardIds.Count; n++)
                {
                    int want = _chosenCardIds[n];
                    for (int i = 0; i < cards.Count; i++)
                    {
                        if (cards[i] != null && cards[i].Id == want && !picked.Contains(cards[i]))
                        {
                            picked.Add(cards[i]);
                            break;
                        }
                    }
                    if (picked.Count >= max)
                        break;
                }
            }
            if (picked.Count == 0 && !cancelable && cards != null && cards.Count > 0)
                picked.Add(cards[0]);
            while (picked.Count < min && cards != null)
            {
                bool added = false;
                for (int i = 0; i < cards.Count; i++)
                {
                    if (cards[i] != null && !picked.Contains(cards[i]))
                    {
                        picked.Add(cards[i]);
                        added = true;
                        break;
                    }
                }
                if (!added)
                    break;
            }
            ClearChoice();
            _selectCards = null;
            return picked;
        }

        public override int OnAnnounceCard(IList<int> avail)
        {
            ClearChoice();
            _announceIds = avail;
            EnsureChoice("announce", null);
            int chosen = _chosenCardId;
            ClearChoice();
            _announceIds = null;
            if (avail != null)
            {
                for (int i = 0; i < avail.Count; i++)
                {
                    if (avail[i] == chosen)
                        return chosen;
                }
                if (avail.Count > 0)
                    return avail[0];
            }
            return 0;
        }

        public override void OnSelectChain(IList<ClientCard> cards)
        {
            _chainPrompt = true;
            _chainCards = cards;
            ClearChoice();
        }

        public override int OnSelectOption(IList<long> options)
        {
            ClearChoice();
            _optionValues = options;
            EnsureChoice("option", null);
            int idx = _chosenOptionIndex;
            ClearChoice();
            _optionValues = null;
            if (idx >= 0 && options != null && idx < options.Count)
                return idx;
            return 0;
        }

        private string InferSelectRole(long hint, int min)
        {
            if (CurrentCard != null && CurrentCard.Id == ToonCardId.ComicCat)
                return min <= 1 ? "tribute" : "summon_target";
            if (hint == HintRelease)
                return "tribute";
            if (hint == HintSpSummon || hint == HintSummon)
                return "summon_target";
            if (hint == HintToHand)
                return "search";
            if (hint == HintToGrave || hint == HintDiscard)
                return "send";
            if (hint == HintTarget)
                return "target";
            return "target";
        }

        private static string ExtractJsonString(string json, string key)
        {
            string needle = "\"" + key + "\"";
            int i = json.IndexOf(needle);
            if (i < 0)
                return "";
            int colon = json.IndexOf(':', i + needle.Length);
            if (colon < 0)
                return "";
            int q1 = json.IndexOf('"', colon + 1);
            if (q1 < 0)
                return "";
            int q2 = json.IndexOf('"', q1 + 1);
            if (q2 < 0)
                return "";
            return json.Substring(q1 + 1, q2 - q1 - 1);
        }

        private static string ExtractJsonNumber(string json, string key)
        {
            string needle = "\"" + key + "\"";
            int i = json.IndexOf(needle);
            if (i < 0)
                return "";
            int colon = json.IndexOf(':', i + needle.Length);
            if (colon < 0)
                return "";
            int start = colon + 1;
            while (start < json.Length && (json[start] == ' ' || json[start] == '\t'))
                start++;
            int end = start;
            while (end < json.Length && (char.IsDigit(json[end]) || json[end] == '-'))
                end++;
            return json.Substring(start, end - start);
        }

        private static List<int> ExtractJsonNumberArray(string json, string key)
        {
            List<int> ids = new List<int>();
            string needle = "\"" + key + "\"";
            int i = json.IndexOf(needle);
            if (i < 0)
                return ids;
            int bracket = json.IndexOf('[', i + needle.Length);
            if (bracket < 0)
                return ids;
            int end = json.IndexOf(']', bracket + 1);
            if (end < 0)
                return ids;
            string inner = json.Substring(bracket + 1, end - bracket - 1);
            string[] parts = inner.Split(',');
            for (int n = 0; n < parts.Length; n++)
            {
                string token = parts[n].Trim();
                int parsed;
                if (int.TryParse(token, out parsed))
                    ids.Add(parsed);
            }
            return ids;
        }
    }
}
