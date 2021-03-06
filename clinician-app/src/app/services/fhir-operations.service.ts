import { Injectable } from '@angular/core';
import * as FHIR from './../interfaces/FHIR';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class FhirOperationsService {

  constructor() { }

  generateQuestionnaireResponse(formValues, quest: any, patientUUID, questionnaireName) {
    const scope = this;
    const questionnaireResponse = new FHIR.QuestionnaireResponse();
    const identifier = new FHIR.Identifier();
    
    if (patientUUID) {
      const _subject = new FHIR.Reference();
      _subject.reference = patientUUID;
      questionnaireResponse.subject = _subject;
    }

    // questionnaire id
    const questionnaireId = quest.resourceType + '/' + quest.id; 
    questionnaireResponse.questionnaire = questionnaireId;

    identifier.value = questionnaireName;
    questionnaireResponse.identifier = identifier;
    questionnaireResponse.resourceType = 'QuestionnaireResponse'
    questionnaireResponse.status = 'completed';
    questionnaireResponse.authored = new Date();
    questionnaireResponse.item = [];

    quest.item.forEach(elementGroup => {
        const questionnaireResponseGroupItem = scope.generateQuestionnaireResponseGroupItem(elementGroup.linkId, elementGroup.text);
        questionnaireResponseGroupItem.item = [];
        elementGroup.item.forEach(elementItem => {
          const questionnaireResponseItem = scope.generateQuestionnaireResponseItem(elementItem, elementGroup.linkId + '_' + elementItem.linkId, formValues[elementGroup.linkId][elementItem.linkId]);
          if (questionnaireResponseItem !== null) {
            questionnaireResponseGroupItem.item.push(questionnaireResponseItem);
          }
        });
        if (questionnaireResponseGroupItem.item.length > 0)
          questionnaireResponse.item.push(questionnaireResponseGroupItem);
    });

    return questionnaireResponse;
  }

  generateQuestionnaireResponseGroupItem(linkId, text) {
    const questionnaireResponseGroupItem = new FHIR.QuestionnaireResponseGroupItem();
    questionnaireResponseGroupItem.linkId = linkId;
    questionnaireResponseGroupItem.text = text;
    return questionnaireResponseGroupItem;
  }

  generateQuestionnaireResponseItem(elementItem, linkId, childItem) {
    let returnItem = null;

    if (childItem) {
      const questionnaireResponseItem = new FHIR.QuestionnaireResponseItem();
      const questionnaireAnswer = new FHIR.Answer();
      questionnaireResponseItem.answer = [];
      var answer: FHIR.AnswerOption;

      if (elementItem.type == "boolean") {
        questionnaireAnswer.valueBoolean = childItem === "yes" ? true : false;
      } else if (elementItem.type == "choice") {
        questionnaireAnswer.valueCoding = new FHIR.Coding();
        questionnaireAnswer.valueCoding.code = childItem;
        answer = this.getAnswerSelected(elementItem.answerOption, childItem)
        questionnaireAnswer.valueCoding.system = answer.valueCoding.system;
        questionnaireAnswer.valueCoding.display = answer.valueCoding.display;

      } else if (elementItem.type == "date") {
        questionnaireAnswer.valueDate = new Date(childItem);
      } else {
        questionnaireAnswer.valueString = childItem;
      }
      questionnaireResponseItem.linkId = linkId;
      questionnaireResponseItem.answer.push(questionnaireAnswer);
      returnItem = questionnaireResponseItem
    }

    return returnItem;
  }

  getAnswerSelected(answers, responseSelected) {
    for (let answer of answers) {
      if (answer.valueCoding.code == responseSelected) {
        return answer;
      }
    }
  }

  generatePatient(patientObj) {
    const patient = new FHIR.Patient();
    patient.resourceType = 'Patient';
    patient.active = true;
    
    const humanName = new FHIR.HumanName();
    humanName.family = patientObj.last_name;
    humanName.given = []
    humanName.given.push(patientObj.first_name);
    patient.name = [humanName];

    patient.gender = patientObj.sex_at_birth;

    // clearity date is in format MM/DD/YYYY
    patient.birthDate = moment(patientObj.date_of_birth, 'MM-DD-YYYY').format('YYYY-MM-DD');

    const address = new FHIR.Address();
    address.line = [patientObj.address_line_1];
    address.city = patientObj.address_city;
    address.state = patientObj.address_province;
    address.postalCode = patientObj.address_postal_code;
    address.country = patientObj.address_country;
    patient.address = [address];

    // extensions
    patient.extension = [];

    const healthcare_worker = new FHIR.Extension();
    healthcare_worker.url = 'https://smilecdr.com/extensions/healthcare-worker';
    healthcare_worker.valueString = patientObj.healthcare_worker;

    patient.extension.push(healthcare_worker);

    const laboratory_worker = new FHIR.Extension();
    laboratory_worker.url = 'https://smilecdr.com/extensions/laboratory-worker';
    laboratory_worker.valueString = patientObj.laboratory_worker;

    patient.extension.push(laboratory_worker);

    const pregnant = new FHIR.Extension();
    pregnant.url = 'https://smilecdr.com/extensions/pregnant';
    pregnant.valueString = patientObj.pregnant;

    patient.extension.push(pregnant);

    if (patientObj.pregnant == 'yes' && patientObj.gestational_weeks_assessment) {
      const gestational_weeks_assessment = new FHIR.Extension();
      gestational_weeks_assessment.url = 'https://smilecdr.com/extensions/gestational-weeks-assessment';
      gestational_weeks_assessment.valueString = patientObj.gestational_weeks_assessment;

      patient.extension.push(gestational_weeks_assessment);
    }

    return patient;
  }


  generateEpisodeOfCare(patientId, status, careteamId) {
    const eoc = new FHIR.EpisodeOfCare();
    eoc.resourceType = 'EpisodeOfCare';
    eoc.status = status;

    // add team ref to care team
    const _ct = new FHIR.Reference();
    _ct.reference = careteamId;
    eoc.team = [_ct];

    const _patient = new FHIR.Reference();
    _patient.reference = patientId;
    eoc.patient = _patient;

    return eoc;
  }

  generateEncounter(eocId, patId, status) {
    const encounter = new FHIR.Encounter();
    encounter.resourceType = 'Encounter';
    encounter.status = status;

    const _eoc = new FHIR.Reference();
    _eoc.reference = eocId;
    encounter.episodeOfCare = [_eoc];

    const _subject = new FHIR.Reference();
    _subject.reference = patId;
    encounter.subject = _subject;
    
    encounter.participant = [];
    const pracRef = new FHIR.Reference();
    pracRef.reference = 'Practitioner/516'
    encounter.participant[0] = new FHIR.Participant();
    encounter.participant[0].individual = pracRef;
    
    return encounter;
  }

  generateCareTeam(patientId) {
    const ct = new FHIR.CareTeam();
    ct.resourceType = 'CareTeam';
    ct.status = 'proposed';

    const _subject = new FHIR.Reference();
    _subject.reference = patientId;
    ct.subject = _subject;

    return ct;
  }
  
}
