// Protected exercise metadata. Editorial JSON cannot replace these objects.
import {activities,assess} from './traversee.js';
import {courses,assessNew} from './premiere.js';
import {consolidationCourses} from './consolidation.js';
import {statement} from './statements.js';
export const activityGroups={traversee:activities,...courses,...consolidationCourses};
export function metadata(sequence,id){const activity=activityGroups[sequence]?.find(a=>a.id===id);if(!activity)throw Error('Activité inconnue');return {activity,contract:statement(sequence,activity),assess:sequence==='traversee'?assess:assessNew};}
