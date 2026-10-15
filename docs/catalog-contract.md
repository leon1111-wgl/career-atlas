# Catalog contract
JSON root {version:1, reviewedAt:"2026-10-15", industries:[], roles:[], majors:[], publicPaths:[], sources:[]}
industry: {id,name,en,category,summary,chain:[{stage,description,roles:[role IDs]}],businessModel,drivers:[strings],risks:[strings],watch:[strings],cnWageIndustry: exact NBS sector name,roleIds:[],companies:{CN:[{name,url,note}],US:[{name,url,note}]},cities:{CN:[strings],US:[strings]},sourceIds:[]}
role: {id,title,industryId,soc:US SOC code or null,summary,daily:[strings],skills:[strings],majors:[major IDs],education,entry,portfolio,transition:[role IDs],ai:{automated:[strings],complement:[strings]},rubric:{moat:{value:1..5,reason:string},ai:{value:1..5,reason:string},access:{value:1..5,reason:string}},sourceIds:[]}
major: {id,name,category,directions:[strings],roleIds:[],advice}
publicPath: {id,title,region:"CN"|"US",summary,steps:[strings],checks:[strings],url}
source: {id,title,url,type:"official"|"editorial"|"open-source",note}
No invented wages, demand percentages, vacancy counts, model scores. All narrative original editorial guidance. No attribution impersonation. Companies illustrative employment contexts, not asserted current openings. Cover AI agent vs ML research vs data/platform/customer-success; main CS, engineering, health, law, education, economics, arts, humanities, agri/trades/public paths.
