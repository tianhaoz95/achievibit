import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { isEqual } from 'lodash';

import { USER_MODEL_NAME, UserSchema } from '@kb-models';

import { closeDatabase, TestDatabaseModule } from '../../db-test.module';
import { dtoMockGenerator } from '../../dto.mock-generator';
import { UsersService } from './users.service';


describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestDatabaseModule,
        MongooseModule.forFeature([ { name: USER_MODEL_NAME, schema: UserSchema } ])
      ],
      providers: [
        UsersService
      ]
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  it('should be able to create and get a user', async () => {
    const user = dtoMockGenerator.userDto();

    const createdUser = await service.create(user);

    const foundUser = await service.findOne(user.username);

    expect(isEqual(foundUser, createdUser)).toBeTruthy();
  });

  it('should be able to get all users', async () => {
    const user1 = dtoMockGenerator.userDto();
    const user2 = dtoMockGenerator.userDto();

    const createdUser1 = await service.create(user1);
    const createdUser2 = await service.create(user2);

    const foundUsers = await service.findAll();

    expect(foundUsers).toContainEqual(createdUser1);
    expect(foundUsers).toContainEqual(createdUser2);
    expect(foundUsers.length).toBeGreaterThanOrEqual(2);
  });
});
