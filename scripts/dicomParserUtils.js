/*! Utils for dicomParser library */

var UNKNOWN_DATE = "1900-01-01";
var UNKNOWN_MICROSECONDS = ".000Z";
var UNKNOWN_TIME = "00:00:00" + UNKNOWN_MICROSECONDS;
var UNKNOWN_STRING = "unknown";
var UNKNOWN_QUANTITY = "00";

// Formats the study date and the series date as the django model expects
function parseDateTimeAsString(the_date, the_time) {
    // TO DO: check if this function matches the standard

    var output_date = UNKNOWN_DATE;

    if (the_date !== undefined && the_date.length === 8) {
        //The date format is correct
        var year = the_date.substring(0, 4);
        var month = the_date.substring(4, 6);
        var days = the_date.substring(6, 8);
        output_date = year + "-" + month + "-" + days + "T";

        if (the_time !== undefined && the_time.length > 5) {
            //The time format is correct (at least hours, minutes and seconds)
            var hours = the_time.substring(0, 2);
            var minutes = the_time.substring(2, 4);
            var seconds = the_time.substring(4, 6);
            output_date += hours + ":" + minutes + ":" + seconds;
            if (the_time.length > 9) {
                var microseconds = the_time.substring(7, 10);
                output_date += "." + microseconds + "Z";
            }
            else{
                output_date += UNKNOWN_MICROSECONDS;
            }
        }
        else {
            output_date += UNKNOWN_TIME;
        }
    }

    return output_date;
}

// Formats the birth date as the django model expects
function parseBirthDate(the_date) {
    var output_date = UNKNOWN_DATE;
    if (the_date !== undefined && the_date.length === 8) {
        //The date format is correct
        var year = the_date.substring(0, 4);
        var month = the_date.substring(4, 6);
        var days = the_date.substring(6, 8);
        output_date_check = days + "-" + month + "-" + year;

        var bits = output_date_check.split('-');
        var d = new Date(bits[2] + '/' + bits[1] + '/' + bits[0]);
        if (!!(d && (d.getMonth() + 1) == bits[1] && d.getDate() == Number(bits[0]))){
            output_date = year + "-" + month + "-" + days;
        }
    }
    return output_date
}

//Creates a javascript object with the needed information, from the dicom tags, to feed the django model.
function dumpToJson(jsonDataModel, dataSet) {

    var patient_id = dataSet.string(TAG_DICT['PATIENTID']);
    patient_id = (patient_id === undefined) ? UNKNOWN_STRING : patient_id;
    var study_id = dataSet.string(TAG_DICT['STUDYINSTANCEUID']);
    //study_id = (study_id === undefined) ? UNKNOWN_STRING : study_id;
    var series_id = dataSet.string(TAG_DICT['SERIESINSTANCEUID']);

    if ((series_id === undefined) || (study_id === undefined)){
        // series_instance_uid and study_instance_uid are compulsory according to the standard
        return false;
    }

    // Parsing the patient related metadata
    if (jsonDataModel[patient_id] === undefined) {
        var patient_name = dataSet.string(TAG_DICT['PATIENTNAME']);
        patient_name = (patient_name === undefined || patient_id === UNKNOWN_STRING) ? UNKNOWN_STRING : patient_name;
        var birth_date = parseBirthDate(dataSet.string(TAG_DICT['PATIENTBIRTHDATE']));
        var sex = dataSet.string(TAG_DICT['PATIENTSEX']);
        sex = (sex === undefined) ? UNKNOWN_STRING : sex;
        var studies = {};
        jsonDataModel[patient_id] = {"patient_name": patient_name, "birth_date": birth_date, "sex": sex, "studies": studies};
    }

    // Parsing the study related metadata
    if (jsonDataModel[patient_id]['studies'][study_id] === undefined) {
        var accession_number = dataSet.string(TAG_DICT['ACCESSIONNUMBER']);
        accession_number = (accession_number === undefined) ? UNKNOWN_STRING : accession_number;

        var study_date = dataSet.string(TAG_DICT['STUDYDATE']);
        var study_time = dataSet.string(TAG_DICT['STUDYTIME']);
        var datetime = parseDateTimeAsString(study_date, study_time);

        var referring_physician = dataSet.string(TAG_DICT['REFERRINGPHYSICIANNAME']);
        referring_physician = (referring_physician === undefined) ? UNKNOWN_STRING : referring_physician;
        var requesting_physician = dataSet.string(TAG_DICT['REQUESTINGPHYSICIAN']);
        requesting_physician = (requesting_physician === undefined) ? UNKNOWN_STRING : requesting_physician;
        var reading_physician = dataSet.string(TAG_DICT['NAMEOFPHYSICIANSREADINGSTUDY']);
        reading_physician = (reading_physician === undefined) ? UNKNOWN_STRING : reading_physician;
        var institution = dataSet.string(TAG_DICT['INSTITUTIONNAME']);
        institution = (institution === undefined) ? UNKNOWN_STRING : institution;
        var description = dataSet.string(TAG_DICT['STUDYDESCRIPTION']);
        description = (description === undefined) ? UNKNOWN_STRING : description;
        var number_series = dataSet.string(TAG_DICT['NUMBEROFSTUDYRELATEDSERIES']);
        number_series = (number_series === undefined) ? UNKNOWN_QUANTITY : number_series;
        var body_part_examined = dataSet.string(TAG_DICT['BODYPARTEXAMINED']);
        body_part_examined = (body_part_examined === undefined) ? UNKNOWN_STRING : body_part_examined;
        var series = {};

        jsonDataModel[patient_id]['studies'][study_id] = {"accession_number": accession_number, "datetime": datetime, "referring_physician": referring_physician, "requesting_physician": requesting_physician, "reading_physician": reading_physician, "institution": institution, "description": description, "number_series": number_series, "body_part_examined": body_part_examined, "series": series};
    }

    // Parsing the series related metadata
    if (jsonDataModel[patient_id]['studies'][study_id]['series'][series_id] === undefined) {

        var series_date = dataSet.string(TAG_DICT['SERIESDATE']);
        var series_time = dataSet.string(TAG_DICT['SERIESTIME']);
        var datetime = parseDateTimeAsString(series_date, series_time);

        var description = dataSet.string(TAG_DICT['SERIESDESCRIPTION']);
        description = (description === undefined) ? UNKNOWN_STRING : description;
        var modality = dataSet.string(TAG_DICT['MODALITY']);
        modality = (modality === undefined) ? UNKNOWN_STRING : modality;

        jsonDataModel[patient_id]['studies'][study_id]['series'][series_id] = {"datetime": datetime, "number_slices": 0, "description": description, "modality": modality};
    }

    jsonDataModel[patient_id]['studies'][study_id]['series'][series_id]["number_slices"]++;

    return [patient_id, study_id, series_id];
}
