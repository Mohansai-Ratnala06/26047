import { Request, Response, NextFunction } from 'express';
import { doctorAuthService } from '../services/doctorAuth.service';
import { doctorLoginSchema } from '../validators/doctor.validator';

export const doctorController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body with Zod
      const parseResult = doctorLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
        return;
      }

      const { email, password } = parseResult.data;
      const result = await doctorAuthService.login(email, password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', details: 'Invalid email or password' },
        });
        return;
      }
      next(error);
    }
  },
};
