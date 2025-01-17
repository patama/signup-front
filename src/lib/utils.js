import _, {
  assign,
  isBoolean,
  isEmpty,
  isObject,
  isString,
  map,
  mapKeys,
  mergeWith,
  omitBy,
} from 'lodash';
import flatten from 'flat';

export function getErrorMessages(error) {
  if (
    !isEmpty(error.response) &&
    isObject(error.response.data) &&
    error.response.status === 422
  ) {
    return _(error.response.data)
      .values()
      .flatten()
      .value();
  }

  if (!isEmpty(error.response) && isObject(error.response.data)) {
    return _(error.response.data)
      .values()
      .flatten()
      .value();
  }

  const errorMessageEnd =
    'Merci de réessayer ultérieurement. ' +
    'Vous pouvez également nous signaler cette erreur par mail à contact@particulier.api.gouv.fr.';

  if (!isEmpty(error.response)) {
    return [
      `Une erreur est survenue. Le code de l'erreur est ${
        error.response.status
      } (${error.response.statusText}). ${errorMessageEnd}`,
    ];
  }

  console.error(error);
  return [`Une erreur inconnue est survenue. ${errorMessageEnd}`];
}

const validNAFCode = {
  api_particulier: [
    '84', // SERVICES D’ADMINISTRATION PUBLIQUE ET DE DÉFENSE ; SERVICES DE SÉCURITÉ SOCIALE OBLIGATOIRE
    '85', // ENSEIGNEMENT
    '86', // ACTIVITÉS POUR LA SANTÉ HUMAINE
    '88', // Action sociale sans hébergement
  ],
};

export function isValidNAFCode(provider, NAFcode) {
  if (!isString(NAFcode)) {
    return false;
  }

  if (isEmpty(validNAFCode[provider])) {
    return true;
  }

  if (!validNAFCode[provider].includes(NAFcode.substring(0, 2))) {
    return false;
  }

  return true;
}

const diffFieldLabels = {
  cgu_approved: "de l'approbation des CGU",
  data_recipients: 'des destinataires des données',
  data_retention_period: 'de la durée de conservation des données',
  data_retention_comment:
    'de la justification de la durée de conservation des données',
  description: 'de la description',
  fondement_juridique_title: 'de la référence du cadre juridique',
  fondement_juridique_url: "de l'url du cadre juridique",
  intitule: "de l'intitulé",
  'contacts.0.nom': 'du nom du DPD',
  'contacts.0.email': "de l'email du DPD",
  'contacts.0.phone_number': 'du numéro de téléphone du DPD',
  'contacts.1.nom': 'du nom du responsable de traitement',
  'contacts.1.email': "de l'email du responsable de traitement",
  'contacts.1.phone_number':
    'du numéro de téléphone du responsable de traitement',
  'contacts.2.nom': 'du nom du responsable technique',
  'contacts.2.email': "de l'email du responsable technique",
  'contacts.2.phone_number': 'du numéro de téléphone du responsable technique',
};

function flattenDiffTransformer(accumulatorObject, fullObjectDiff, objectKey) {
  if (!isObject(fullObjectDiff[0])) {
    accumulatorObject[objectKey] = fullObjectDiff;

    return accumulatorObject;
  }
  // {contacts: [[{'name': 'c', email: 'd'}], [{'name': 'e', email: 'd'}]]}
  const objectBefore = flatten(fullObjectDiff[0], objectKey);
  const objectAfter = flatten(fullObjectDiff[1], objectKey);
  const objectDiff = mergeWith(
    objectBefore,
    objectAfter,
    (valueBefore, valueAfter) => [valueBefore, valueAfter]
  );
  // {0.name: ['c', 'e'], 0.email: ['d', 'd']}
  const objectDiffNoUnchanged = omitBy(
    objectDiff,
    value => value[0] === value[1]
  );
  // {0.name: ['c', 'e']}
  const objectDiffPrefixedKey = mapKeys(
    objectDiffNoUnchanged,
    (value, flatKey) => `${objectKey}.${flatKey}`
  );
  // {contacts.0.name: ['c', 'e']}
  Object.assign(accumulatorObject, objectDiffPrefixedKey);

  return accumulatorObject;
}

function changelogFormatTransformer(
  accumulatorArray,
  [valueBefore, valueAfter],
  key
) {
  const label = diffFieldLabels[key] ? diffFieldLabels[key] : 'du champ ' + key;
  const displayedValueBefore = isBoolean(valueBefore)
    ? valueBefore
      ? 'coché'
      : 'décoché'
    : valueBefore;
  const displayedValueAfter = isBoolean(valueAfter)
    ? valueAfter
      ? 'coché'
      : 'décoché'
    : valueAfter;

  accumulatorArray.push(
    `Changement ${label} de "${displayedValueBefore}" en "${displayedValueAfter}".`
  );

  return accumulatorArray;
}

export function getChangelog(diff) {
  try {
    return (
      _(diff)
        // { intitule: ['a', 'b'], contacts: [[{'name': 'c', email: 'd'}], [{'name': 'e', email: 'd'}]] }
        .omit(['updated_at'])
        .transform(flattenDiffTransformer, {})
        // { intitule: ['a', 'b'], contacts.0.name: ['c', 'e'] }
        .transform(changelogFormatTransformer, [])
        // ['changement d'intitule de "a" en "b"', 'changement du nom du DPD de "c" en "d"']
        .value()
    );
  } catch (e) {
    // There is a lot of operation involved in this function.
    // We rather fail silently than causing the entire page not to render.
    console.error(e);
    return [];
  }
}

export function hashToQueryParams(hash) {
  const queryParams = _(hash)
    // { a: 1, b: true, c: false, d: [] }
    .omitBy(e => (isObject(e) ? isEmpty(e) : !e))
    // { a: 1, b: true }
    .toPairs()
    // [[ 'a', 1 ], [ 'b', true ]]
    .map(
      ([key, value]) =>
        `${key}=${
          isObject(value) ? encodeURIComponent(JSON.stringify(value)) : value
        }`
    )
    // [ 'a=1', 'b=true' ]
    .value();

  // '?a=1&b=true'
  return isEmpty(queryParams) ? '' : `?${queryParams.join('&')}`;
}

/**
 * copied from https://stackoverflow.com/questions/39127565/merge-array-of-objects-by-property-using-lodash
 * Inspired from lodash#unionBy doc:
 * This method is like `_.union` except that it accepts `iteratee` which is
 * invoked for each element of each `arrays` to generate the criterion by
 * which uniqueness is computed. Result values are chosen from the *second*
 * array in which the value occurs. The iteratee is invoked with one argument:
 * (value).
 *
 * @param leftArray
 * @param rightArray
 * @param comparator
 * @returns {Array}
 */
export function rightUnionBy(leftArray, rightArray, comparator) {
  return map(
    assign(
      ...[leftArray, rightArray].map(coll => mapKeys(coll, v => v[comparator]))
    )
  );
}
