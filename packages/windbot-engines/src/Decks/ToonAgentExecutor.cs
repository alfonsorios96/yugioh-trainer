// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    /// <summary>
    /// Thin proxy: serialize legal MainPhase actions, wait for the agentic
    /// teach server, execute the chosen actionId. Does not decide.
    /// </summary>
    [Deck("Toon2026Agent", "AI_Toon2026")]
    public class ToonAgentExecutor : MetaExecutor
    {
        private const string DefaultUrl = "http://127.0.0.1:8765/v1/decide";
        private string _chosenKind;
        private int _chosenCardId;
        private string _duelId;
        private int _requestSeq;

        public ToonAgentExecutor(GameAI ai, Duel duel)
            : base(ai, duel)
        {
            _duelId = Guid.NewGuid().ToString("N").Substring(0, 12);
            _chosenKind = "";
            _chosenCardId = 0;
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
        }

        public override void OnNewPhase()
        {
            ClearChoice();
        }

        private void ClearChoice()
        {
            _chosenKind = "";
            _chosenCardId = 0;
        }

        private bool DecideActivate()
        {
            return MatchKind("activate");
        }

        private bool DecideSummon()
        {
            return MatchKind("summon");
        }

        private bool DecideSpSummon()
        {
            return MatchKind("spsummon");
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
            ClearChoice();
            return true;
        }

        private void EnsureChoice(string promptKind, string selectRole)
        {
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
            sb.Append("\"constraints\":{");
            sb.Append("\"normalSummonUsed\":false,");
            sb.Append("\"summonCount\":0");
            if (selectRole != null)
                sb.Append(",\"selectRole\":\"").Append(selectRole).Append("\"");
            sb.Append("},");
            sb.Append("\"legalActions\":[");
            sb.Append(LegalActionsJson());
            sb.Append("]");
            sb.Append("}");
            return sb.ToString();
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

        private string LegalActionsJson()
        {
            StringBuilder sb = new StringBuilder();
            bool first = true;
            MainPhase main = Match.MainPhase;
            first = AppendCards(sb, first, "summon", main.SummonableCards);
            first = AppendCards(sb, first, "spsummon", main.SpecialSummonableCards);
            first = AppendCards(sb, first, "activate", main.ActivableCards);
            first = AppendCards(sb, first, "set", main.SpellSetableCards);
            first = AppendCards(sb, first, "set", main.MonsterSetableCards);
            if (!first)
                sb.Append(",");
            sb.Append("{\"id\":\"to-ep\",\"kind\":\"to_ep\"}");
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
            _chosenKind = ExtractJsonString(json, "actionId");
            if (_chosenKind == "to-ep" || _chosenKind == "to_ep")
            {
                _chosenKind = "to_ep";
                _chosenCardId = 0;
                return;
            }
            // actionId like "summon-45536531-0" or response may include kind
            string kind = ExtractJsonString(json, "kind");
            if (kind != "")
                _chosenKind = kind;
            else
            {
                int dash = _chosenKind.IndexOf('-');
                if (dash > 0)
                    _chosenKind = _chosenKind.Substring(0, dash);
            }
            string idField = ExtractJsonNumber(json, "cardId");
            if (idField != "")
                _chosenCardId = int.Parse(idField);
            else
            {
                string[] parts = ExtractJsonString(json, "actionId").Split('-');
                if (parts.Length >= 2)
                {
                    int parsed;
                    if (int.TryParse(parts[1], out parsed))
                        _chosenCardId = parsed;
                }
            }
        }

        public override IList<ClientCard> OnSelectCard(IList<ClientCard> cards, int min, int max, long hint, bool cancelable)
        {
            _chosenKind = "";
            _chosenCardId = 0;
            string role = "summon_target";
            if (CurrentCard != null && CurrentCard.Id == ToonCardId.ComicCat)
                role = min <= 1 ? "tribute" : "summon_target";
            EnsureChoice("select", role);
            List<ClientCard> picked = new List<ClientCard>();
            if (cards != null)
            {
                for (int i = 0; i < cards.Count; i++)
                {
                    if (cards[i] != null && cards[i].Id == _chosenCardId)
                    {
                        picked.Add(cards[i]);
                        break;
                    }
                }
            }
            if (picked.Count == 0 && cards != null && cards.Count > 0)
                picked.Add(cards[0]);
            _chosenKind = "";
            _chosenCardId = 0;
            return picked;
        }

        public override int OnAnnounceCard(IList<int> avail)
        {
            _chosenKind = "";
            _chosenCardId = 0;
            EnsureChoice("announce", null);
            if (avail != null)
            {
                for (int i = 0; i < avail.Count; i++)
                {
                    if (avail[i] == _chosenCardId)
                        return _chosenCardId;
                }
                if (avail.Count > 0)
                    return avail[0];
            }
            return 0;
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
    }
}
