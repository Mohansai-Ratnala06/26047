import { Request, Response } from 'express';
import { patientExplainerAgent } from '../agents/PatientExplainerAgent';

export async function explainBrainDiagnosisHandler(req: Request, res: Response) {
  try {
    const { clinicalDiagnosis, patientId, age, gender, simplicityLevel } = req.body;

    if (!clinicalDiagnosis) {
      return res.status(400).json({
        success: false,
        error: 'clinicalDiagnosis is required from the clinical brain model output.'
      });
    }

    const explanation = await patientExplainerAgent.generatePatientExplanation(
      clinicalDiagnosis,
      {
        patientId,
        age,
        gender,
        primaryLanguage: 'te',
        literacyLevel: simplicityLevel === 'very_simple' ? 'basic' : 'standard'
      },
      {
        simplicityLevel: simplicityLevel || 'standard',
        includeAudio: true,
        voiceName: 'Kore'
      }
    );

    return res.status(200).json({
      success: true,
      data: explanation
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
