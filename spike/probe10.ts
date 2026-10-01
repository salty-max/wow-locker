import { api } from "./probe-lib";
const r = await api("/profile/wow/character/stitches/namzan/specializations", "profile-classic1x-eu");
console.log(r.status, JSON.stringify(r.body.specialization_groups?.map((g: { is_active: boolean; specializations: { specialization_name: string; spent_points: number; talents?: { talent: { id: number }; talent_rank: number; spell_tooltip?: { spell?: { name: string } } }[] }[] }) => ({ active: g.is_active, trees: g.specializations.map((t) => ({ n: t.specialization_name, p: t.spent_points, talents: t.talents?.map((x) => `${x.talent.id}:${x.spell_tooltip?.spell?.name}:${x.talent_rank}`) })) }))));
process.exit(0);
