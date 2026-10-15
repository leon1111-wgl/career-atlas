"""Join official occupation tables only on unique, identical names; never fuzzy-match."""
import copy

def attach_occupations(outcomes, observations, labels=None):
    result = copy.deepcopy(outcomes)
    source = observations.get('sources', {}).get('bls', {})
    by_name = {}
    for soc, row in source.get('value', {}).get('occupations', {}).items():
        if row.get('type') == 'Line item':
            by_name.setdefault(row['name'], []).append(soc)
    for group in result.get('groups', []):
        for row in group['rows']:
            # CN destinations/statuses are never occupation percentages, even if labels happen to match.
            if group['region'] != 'US' or group.get('dataKind') != 'occupation_distribution':
                continue
            row['soc'] = None
            matches = by_name.get(row['occupation'], [])
            if len(matches) == 1:
                row['soc'] = matches[0]
                row['socMapping'] = {'method': 'unique-exact-official-name', 'source': source.get('url'), 'period': source.get('value', {}).get('period')}
            if (labels or {}).get(row['occupation']):
                row['occupationZh'] = labels[row['occupation']]
    return result
